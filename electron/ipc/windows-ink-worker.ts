import { spawn } from 'node:child_process';
import type {
  RecognitionOptions,
  RecognitionResult,
  RecognitionStrokePayload,
} from '../../src/services/recognition/types.ts';
import { sanitizeRecognitionStrokes } from '../../src/services/recognition/types.ts';

export const WINDOWS_INK_WORKER_TIMEOUT_MS = 5_000;
const WINDOWS_INK_TASK_TIMEOUT_MS = 4_500;
const MAX_WORKER_OUTPUT_BYTES = 256 * 1024;

function joinRecognitionSegments(segments: readonly string[]): string {
  let text = '';
  for (const rawSegment of segments) {
    const segment = rawSegment.trim();
    if (!segment) continue;
    if (!text) {
      text = segment;
      continue;
    }
    const closesPreviousToken = /^[,.;:!?%\u2026)\]}]/u.test(segment)
      || /^['\u2019](?:s|d|ll|m|re|t|ve)\b/iu.test(segment);
    const followsOpeningPunctuation = /[(\[{\u201c\u2018]$/u.test(text);
    text += closesPreviousToken || followsOpeningPunctuation ? segment : ` ${segment}`;
  }
  return text.trim();
}

/**
 * Turns ordered Windows Ink result groups into complete phrase candidates.
 * Candidate index zero is the real-time best result; later candidate indexes
 * remain full-phrase alternatives rather than a flattened list of words.
 */
export function aggregateWindowsInkRecognitionGroups(
  groups: readonly (readonly string[])[],
): Pick<RecognitionResult, 'text' | 'candidates'> {
  const normalizedGroups = groups
    .map(group => group
      .map(candidate => typeof candidate === 'string' ? candidate.trim() : '')
      .filter((candidate, index, candidates) => candidate.length > 0 && candidates.indexOf(candidate) === index))
    .filter(group => group.length > 0);
  if (normalizedGroups.length === 0) return { text: '', candidates: [] };

  const alternativeCount = Math.max(...normalizedGroups.map(group => group.length));
  const candidates: string[] = [];
  for (let candidateIndex = 0; candidateIndex < alternativeCount && candidates.length < 24; candidateIndex += 1) {
    const candidate = joinRecognitionSegments(normalizedGroups.map(group => group[candidateIndex] ?? group[0]));
    if (candidate && !candidates.includes(candidate)) candidates.push(candidate);
  }
  return { text: candidates[0] ?? '', candidates };
}

/**
 * PowerShell projects the WinRT return values as IReadOnlyList<T> COM
 * objects. Those objects support IEnumerable traversal, but do not expose
 * WinRT IVectorView Size/GetAt members.
 */
export type WindowsInkReadOnlyListLike<T> = Iterable<T>;

export interface WindowsInkRecognitionResultLike {
  GetTextCandidates(): WindowsInkReadOnlyListLike<string>;
}

/**
 * Mirrors the native worker's projected IReadOnlyList traversal and takes
 * only the best candidate from each ordered result.
 */
export function marshalWindowsInkRecognitionResults(
  results: WindowsInkReadOnlyListLike<WindowsInkRecognitionResultLike>,
): Pick<RecognitionResult, 'text' | 'candidates'> {
  const groups: string[][] = [];
  for (const result of results) {
    const candidateView = result.GetTextCandidates();
    let bestCandidate = '';
    for (const candidate of candidateView) {
      if (typeof candidate === 'string' && candidate.trim()) {
        bestCandidate = candidate;
        break;
      }
    }
    if (bestCandidate) groups.push([bestCandidate]);
  }
  return aggregateWindowsInkRecognitionGroups(groups);
}

// This fixed script is executed by PowerShell; stroke data is separately
// JSON-encoded to the worker's stdin and never interpolated into code.
export const WINDOWS_INK_WORKER = `
$ErrorActionPreference = 'Stop'

function Write-Result([object]$value) {
  [Console]::Out.Write(($value | ConvertTo-Json -Compress -Depth 8))
}

function Convert-WinRTAsyncOperationToTask([object]$operation, [Type]$resultType) {
  if ($null -eq $operation) { throw 'Windows Ink returned no async operation.' }
  Add-Type -AssemblyName System.Runtime.WindowsRuntime
  $bindingFlags = [System.Reflection.BindingFlags]::Public -bor [System.Reflection.BindingFlags]::Static
  $asTaskDefinition = @([System.WindowsRuntimeSystemExtensions].GetMethods($bindingFlags)) | Where-Object {
    if ($_.Name -ne 'AsTask' -or -not $_.IsGenericMethodDefinition) { return $false }
    $parameters = $_.GetParameters()
    return $parameters.Count -eq 1 -and
      $parameters[0].ParameterType.IsGenericType -and
      $parameters[0].ParameterType.GetGenericTypeDefinition().FullName -eq 'Windows.Foundation.IAsyncOperation\`1'
  } | Select-Object -First 1
  if (-not $asTaskDefinition) { throw 'Unable to locate AsTask<TResult>(IAsyncOperation<TResult>).' }

  # PowerShell projects the operation as __ComObject. Closing AsTask with the
  # exact TResult declared by RecognizeAsync and invoking MethodInfo is the
  # supported bridge; direct casts or Status/GetResults projection are invalid.
  $asTask = $asTaskDefinition.MakeGenericMethod($resultType)
  return $asTask.Invoke($null, @($operation))
}

$stage = 'reading the request'
try {
  $inputText = [Console]::In.ReadToEnd()
  $payload = $inputText | ConvertFrom-Json
  $stage = 'initializing Windows Ink'
  $builder = [Windows.UI.Input.Inking.InkStrokeBuilder, Windows.UI.Input.Inking, ContentType=WindowsRuntime]::new()
  $container = [Windows.UI.Input.Inking.InkStrokeContainer, Windows.UI.Input.Inking, ContentType=WindowsRuntime]::new()
  $recognizer = [Windows.UI.Input.Inking.InkRecognizerContainer, Windows.UI.Input.Inking, ContentType=WindowsRuntime]::new()

  $installedRecognizers = @($recognizer.GetRecognizers())
  if ($installedRecognizers.Count -eq 0) {
    Write-Result @{ status = 'unavailable'; text = ''; candidates = @(); isAvailable = $false; error = 'Windows handwriting recognition is unavailable. Install a Windows handwriting language component.' }
    return
  }

  if ($payload.options.language) {
    $requestedTag = [string]$payload.options.language
    $language = [Windows.Globalization.Language, Windows.Globalization, ContentType=WindowsRuntime]::new($requestedTag)
    $requestedLabel = [string]$language.DisplayName
    $languagePatterns = @{
      'en-US' = @('English (US)', 'English (United States)')
      'en-GB' = @('English (UK)', 'English (United Kingdom)')
      'hi-IN' = @('Hindi')
      'es-ES' = @('Spanish')
      'fr-FR' = @('French')
      'de-DE' = @('German', 'Deutsch')
      'ja-JP' = @('Japanese')
      'zh-CN' = @('Chinese (Simplified)')
    }
    $patterns = if ($languagePatterns.ContainsKey($requestedTag)) {
      @($languagePatterns[$requestedTag])
    } else {
      @([string]$language.DisplayName, [string]$language.NativeName)
    }
    $matchingRecognizer = $installedRecognizers | Where-Object {
      $recognizerName = [string]$_.Name
      @($patterns | Where-Object {
        $_ -and $recognizerName.IndexOf([string]$_, [System.StringComparison]::OrdinalIgnoreCase) -ge 0
      }).Count -gt 0
    } | Select-Object -First 1
    if (-not $matchingRecognizer) {
      Write-Result @{ status = 'unavailable'; text = ''; candidates = @(); isAvailable = $false; error = "Windows handwriting recognition is unavailable for $requestedLabel. Install the Windows handwriting language component or choose another language." }
      return
    }
    $recognizer.SetDefaultRecognizer($matchingRecognizer)
  }

  $stage = 'marshalling ink strokes'
  # PowerShell cannot name this projected struct directly on every supported
  # Windows build, so obtain its real CLR type from CreateStroke's parameter.
  $createStroke = $builder.GetType().GetMethods() | Where-Object { $_.Name -eq 'CreateStroke' } | Select-Object -First 1
  $pointType = $createStroke.GetParameters()[0].ParameterType.GetGenericArguments()[0]
  $pointsType = [System.Collections.Generic.List\`\`1].MakeGenericType($pointType)

  foreach ($sourceStroke in @($payload.strokes)) {
    $points = [Activator]::CreateInstance($pointsType)
    foreach ($sourcePoint in @($sourceStroke.points)) {
      $point = [Activator]::CreateInstance($pointType, [object[]]@([single]$sourcePoint.x, [single]$sourcePoint.y))
      [void]$points.Add($point)
    }
    [void]$container.AddStroke($builder.CreateStroke($points))
  }

  $recognizeMethod = $recognizer.GetType().GetMethods() | Where-Object {
    $_.Name -eq 'RecognizeAsync' -and $_.GetParameters().Count -eq 2
  } | Select-Object -First 1
  if (-not $recognizeMethod) { throw 'Unable to inspect Windows Ink RecognizeAsync.' }
  if (-not $recognizeMethod.ReturnType.IsGenericType -or
      $recognizeMethod.ReturnType.GetGenericTypeDefinition().FullName -ne 'Windows.Foundation.IAsyncOperation\`1') {
    throw "Windows Ink returned an unexpected async contract: $($recognizeMethod.ReturnType.FullName)."
  }
  $resultType = $recognizeMethod.ReturnType.GetGenericArguments()[0]
  $stage = 'awaiting RecognizeAsync'
  $operation = $recognizer.RecognizeAsync($container, [Windows.UI.Input.Inking.InkRecognitionTarget, Windows.UI.Input.Inking, ContentType=WindowsRuntime]::All)
  $task = Convert-WinRTAsyncOperationToTask $operation $resultType
  try {
    $completed = $task.Wait(${WINDOWS_INK_TASK_TIMEOUT_MS})
  } catch {
    throw $_.Exception.GetBaseException()
  }
  if (-not $completed) { throw 'Windows Ink recognition timed out.' }
  if ($task.IsCanceled) { throw 'Windows Ink recognition was canceled.' }
  if ($task.IsFaulted) { throw $task.Exception.GetBaseException() }
  $resultProperty = $task.GetType().GetProperty('Result')
  if (-not $resultProperty) { throw 'Windows Ink recognition task returned no result.' }
  $results = $resultProperty.GetValue($task)
  if ($null -eq $results) { throw 'Windows Ink recognition task returned a null result collection.' }

  $stage = 'enumerating recognition results'
  $resultGroups = @()
  foreach ($result in $results) {
    $stage = 'reading text candidates'
    $candidateView = $result.GetTextCandidates()
    $stage = 'enumerating text candidates'
    $bestCandidate = $null
    foreach ($candidate in $candidateView) {
      if ($null -ne $candidate -and ([string]$candidate).Trim().Length -gt 0) {
        $bestCandidate = [string]$candidate
        break
      }
    }
    if ($null -ne $bestCandidate) {
      $resultGroups += @{ candidates = @($bestCandidate) }
    }
  }
  $stage = 'writing recognition result'
  Write-Result @{ status = $(if ($resultGroups.Count -gt 0) { 'success' } else { 'empty' }); text = ''; candidates = @(); resultGroups = @($resultGroups); isAvailable = $true }
} catch {
  Write-Result @{ status = 'error'; text = ''; candidates = @(); isAvailable = $true; error = "Windows handwriting bridge failed while $($stage): $($_.Exception.GetBaseException().Message)" }
}
`;

export function unavailableRecognitionResult(error: string): RecognitionResult {
  return { status: 'unavailable', text: '', candidates: [], isAvailable: false, error };
}

export function failedRecognitionResult(error: string): RecognitionResult {
  return { status: 'error', text: '', candidates: [], isAvailable: true, error };
}

export function parseWindowsInkWorkerResult(output: string): RecognitionResult {
  const parsed: unknown = JSON.parse(output);
  if (!parsed || typeof parsed !== 'object') {
    return failedRecognitionResult('Windows handwriting recognition returned an invalid response.');
  }
  const value = parsed as Partial<RecognitionResult> & { resultGroups?: unknown };
  if (!['success', 'empty', 'unavailable', 'error'].includes(value.status ?? '')) {
    return failedRecognitionResult('Windows handwriting recognition returned a response with no valid status.');
  }
  const resultGroups = Array.isArray(value.resultGroups)
    ? value.resultGroups.flatMap(group => {
      if (!group || typeof group !== 'object') return [];
      const rawCandidates = (group as { candidates?: unknown }).candidates;
      return Array.isArray(rawCandidates)
        ? [rawCandidates.filter((candidate): candidate is string => typeof candidate === 'string')]
        : [];
    })
    : [];
  const aggregated = resultGroups.length > 0
    ? aggregateWindowsInkRecognitionGroups(resultGroups)
    : null;
  const text = aggregated?.text ?? (typeof value.text === 'string' ? value.text : '');
  const candidates = aggregated?.candidates ?? (Array.isArray(value.candidates)
    ? value.candidates.filter((candidate): candidate is string => typeof candidate === 'string').slice(0, 24)
    : []);
  const status = value.status === 'success' || value.status === 'empty'
    ? (text.trim() ? 'success' : 'empty')
    : value.status;
  return {
    status: status as RecognitionResult['status'],
    text,
    candidates,
    isAvailable: value.status !== 'unavailable',
    error: typeof value.error === 'string' ? value.error : undefined,
  };
}

export type WindowsInkWorkerRunner = typeof runWindowsInkWorker;

export async function recognizeWindowsInkRequest(
  strokes: unknown,
  options?: RecognitionOptions,
  runWorker: WindowsInkWorkerRunner = runWindowsInkWorker,
  platform = process.platform,
): Promise<RecognitionResult> {
  if (platform !== 'win32') {
    return unavailableRecognitionResult('Handwriting recognition is not supported on this platform.');
  }
  try {
    const sanitized = sanitizeRecognitionStrokes(strokes);
    if (sanitized.length === 0) {
      return failedRecognitionResult('Recognition requires at least one handwriting stroke with two or more points.');
    }
    const language = typeof options?.language === 'string' && options.language.length <= 35
      ? options.language.trim()
      : undefined;
    const result = await runWorker(sanitized, { language });
    return { ...result, language: language || result.language };
  } catch (error) {
    return failedRecognitionResult(error instanceof Error ? error.message : 'Invalid handwriting recognition request.');
  }
}

export function runWindowsInkWorker(
  payload: RecognitionStrokePayload[],
  options?: RecognitionOptions,
): Promise<RecognitionResult> {
  return new Promise((resolve) => {
    const worker = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', WINDOWS_INK_WORKER], {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let output = '';
    let errorOutput = '';
    let settled = false;

    const settle = (result: RecognitionResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(result);
    };
    const timeout = setTimeout(() => {
      worker.kill();
      settle(failedRecognitionResult('Windows handwriting recognition worker timed out.'));
    }, WINDOWS_INK_WORKER_TIMEOUT_MS);

    worker.stdout.on('data', (chunk: Buffer) => {
      output += chunk.toString('utf8');
      if (Buffer.byteLength(output, 'utf8') > MAX_WORKER_OUTPUT_BYTES) {
        worker.kill();
        settle(failedRecognitionResult('Windows handwriting recognition returned too much data.'));
      }
    });
    worker.stderr.on('data', (chunk: Buffer) => {
      errorOutput += chunk.toString('utf8');
      if (Buffer.byteLength(errorOutput, 'utf8') > MAX_WORKER_OUTPUT_BYTES) {
        errorOutput = errorOutput.slice(0, MAX_WORKER_OUTPUT_BYTES);
      }
    });
    worker.on('error', error => settle(failedRecognitionResult(`Unable to start Windows handwriting recognition: ${error.message}`)));
    worker.on('close', () => {
      if (settled) return;
      try {
        settle(parseWindowsInkWorkerResult(output.trim()));
      } catch {
        settle(failedRecognitionResult(errorOutput.trim() || 'Windows handwriting recognition returned an invalid response.'));
      }
    });

    worker.stdin.end(JSON.stringify({ strokes: payload, options }));
  });
}
