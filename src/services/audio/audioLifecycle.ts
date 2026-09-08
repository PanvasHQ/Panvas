export interface PageAudioOwner {
  workspaceId: string;
  notebookId: string;
  pageId: string;
}

export function samePageAudioOwner(left?: PageAudioOwner, right?: PageAudioOwner): boolean {
  return Boolean(left && right
    && left.workspaceId === right.workspaceId
    && left.notebookId === right.notebookId
    && left.pageId === right.pageId);
}

export const RECORDING_MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/mp4',
] as const;

export function negotiateRecordingMimeType(isTypeSupported: (mimeType: string) => boolean): string | undefined {
  return RECORDING_MIME_CANDIDATES.find(type => {
    try { return isTypeSupported(type); } catch { return false; }
  });
}

type MediaRecorderConstructor = {
  new(stream: MediaStream, options?: MediaRecorderOptions): MediaRecorder;
  isTypeSupported?: (mimeType: string) => boolean;
};

/** Capability probing is advisory. Some Electron/Chromium builds can record
 * with their default container even when isTypeSupported is missing or
 * reports no candidate. */
export function createSupportedMediaRecorder(stream: MediaStream, Recorder: MediaRecorderConstructor = MediaRecorder): MediaRecorder {
  const selected = Recorder.isTypeSupported
    ? negotiateRecordingMimeType(type => Recorder.isTypeSupported!(type))
    : undefined;
  if (selected) {
    try { return new Recorder(stream, { mimeType: selected }); } catch { /* default below */ }
  }
  return new Recorder(stream);
}

export function audioFileExtension(mimeType: string): string {
  const normalized = mimeType.toLowerCase().split(';')[0].trim();
  if (normalized === 'audio/ogg') return 'ogg';
  if (normalized === 'audio/mp4' || normalized === 'audio/x-m4a') return 'm4a';
  if (normalized === 'audio/mpeg') return 'mp3';
  if (normalized === 'audio/wav' || normalized === 'audio/x-wav') return 'wav';
  const subtype = normalized.split('/')[1]?.replace(/^x-/, '').replace(/[^a-z0-9]/g, '');
  return subtype || 'audio';
}

/** Stored binary metadata is authoritative for playback. A note's MIME is a
 * compatibility fallback for older metadata rows, never a forced container. */
export function resolvePlaybackMimeType(storedMimeType?: string, fallbackMimeType?: string): string | undefined {
  if (typeof storedMimeType === 'string' && /^audio\//i.test(storedMimeType.trim())) return storedMimeType.trim();
  if (typeof fallbackMimeType === 'string' && /^audio\//i.test(fallbackMimeType.trim())) return fallbackMimeType.trim();
  return undefined;
}

/** Reconstructs a playable blob without changing either the stored bytes or
 * the container MIME. This is the single store -> playback boundary. */
export function createPlaybackBlob(data: ArrayBuffer, storedMimeType?: string, fallbackMimeType?: string): Blob {
  const mimeType = resolvePlaybackMimeType(storedMimeType, fallbackMimeType);
  if (!mimeType) throw new Error('This recording has no supported audio format.');
  if (!(data instanceof ArrayBuffer) || data.byteLength === 0) throw new Error('The local audio file is empty.');
  const ownedBytes = data.slice(0);
  return new Blob([ownedBytes], { type: mimeType });
}

export function audioNoteTitle(note: { title?: string; fileName: string }): string {
  return note.title?.trim() || note.fileName;
}

export function recordingErrorMessage(error: unknown): string {
  const source = typeof error === 'object' && error && 'error' in error ? error.error : error;
  const name = typeof source === 'object' && source && 'name' in source ? String(source.name) : '';
  if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') {
    return 'Microphone permission was denied. Allow microphone access and try again.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'No microphone is available.';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') {
    return 'The microphone is busy or could not be read.';
  }
  if (name === 'NotSupportedError') {
    return 'Audio recording is not supported in this environment.';
  }
  if (name === 'RecordingInterruptedError') {
    return 'The recording was interrupted before it could be saved.';
  }
  return source instanceof Error && source.message
    ? source.message
    : 'The recording was interrupted before it could be saved.';
}

export function formatAudioTime(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

interface RecorderLike {
  state: string;
  mimeType: string;
  ondataavailable: ((this: any, event: any) => any) | null;
  onstop: ((this: any, event: any) => any) | null;
  onerror: ((this: any, event: any) => any) | null;
  start(timeslice?: number): void;
  stop(): void;
}

interface StreamLike {
  getTracks(): Array<{ stop(): void }>;
}

export interface CompletedRecording {
  owner: PageAudioOwner;
  blob: Blob;
  mimeType: string;
  durationMs: number;
  startedAt: number;
}

interface RecordingSessionOptions {
  owner: PageAudioOwner;
  recorder: RecorderLike;
  stream: StreamLike;
  selectedMimeType?: string;
  now?: () => number;
  onComplete: (recording: CompletedRecording) => Promise<void>;
  onError?: (error: unknown) => void;
}

/** A recorder plus the immutable page identity captured when recording starts. */
export class PageAudioRecordingSession {
  readonly owner: Readonly<PageAudioOwner>;
  readonly startedAt: number;

  private readonly recorder: RecorderLike;
  private readonly stream: StreamLike;
  private readonly selectedMimeType?: string;
  private readonly now: () => number;
  private readonly onComplete: RecordingSessionOptions['onComplete'];
  private readonly onError?: RecordingSessionOptions['onError'];
  private readonly chunks: Blob[] = [];
  private stopRequested = false;
  private finalized = false;
  private tracksStopped = false;
  private resolveCompletion!: () => void;
  private rejectCompletion!: (error: unknown) => void;
  readonly completion: Promise<void>;

  constructor(options: RecordingSessionOptions) {
    this.owner = Object.freeze({ ...options.owner });
    this.recorder = options.recorder;
    this.stream = options.stream;
    this.selectedMimeType = options.selectedMimeType;
    this.now = options.now ?? Date.now;
    this.onComplete = options.onComplete;
    this.onError = options.onError;
    this.startedAt = this.now();
    this.completion = new Promise<void>((resolve, reject) => {
      this.resolveCompletion = resolve;
      this.rejectCompletion = reject;
    });

    this.recorder.ondataavailable = event => {
      if (!this.finalized && event.data.size > 0) this.chunks.push(event.data);
    };
    this.recorder.onstop = () => { void this.finalize(); };
    this.recorder.onerror = event => this.fail(event);
  }

  start(): void {
    try {
      this.recorder.start(500);
    } catch (error) {
      this.fail(error);
    }
  }

  stop(): Promise<void> {
    if (this.stopRequested || this.finalized) return this.completion;
    this.stopRequested = true;
    if (this.recorder.state === 'inactive') void this.finalize();
    else this.recorder.stop();
    return this.completion;
  }

  private async finalize(): Promise<void> {
    if (this.finalized) return;
    this.finalized = true;
    this.clearCallbacks();
    this.stopTracks();
    const mimeType = this.recorder.mimeType || this.chunks.find(chunk => /^audio\//i.test(chunk.type))?.type || this.selectedMimeType;
    if (!mimeType || !/^audio\//i.test(mimeType)) {
      this.fail(new DOMException('The recorder did not produce a supported audio format.', 'NotSupportedError'), true);
      return;
    }
    const blob = new Blob(this.chunks, { type: mimeType });
    if (blob.size === 0) {
      this.fail(new Error('The recording was interrupted before audio was captured.'), true);
      return;
    }
    try {
      await this.onComplete({
        owner: this.owner as PageAudioOwner,
        blob,
        mimeType,
        durationMs: Math.max(0, this.now() - this.startedAt),
        startedAt: this.startedAt,
      });
      this.resolveCompletion();
    } catch (error) {
      this.onError?.(error);
      this.rejectCompletion(error);
    }
  }

  private fail(error: unknown, alreadyFinalized = false): void {
    if (this.finalized && !alreadyFinalized) return;
    this.finalized = true;
    this.clearCallbacks();
    this.stopTracks();
    this.onError?.(error);
    this.rejectCompletion(error);
  }

  private stopTracks(): void {
    if (this.tracksStopped) return;
    this.tracksStopped = true;
    this.stream.getTracks().forEach(track => track.stop());
  }

  private clearCallbacks(): void {
    this.recorder.ondataavailable = null;
    this.recorder.onstop = null;
    this.recorder.onerror = null;
  }
}

export type PlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'ended' | 'error';

export interface AudioPlaybackState {
  activeNoteId: string | null;
  status: PlaybackStatus;
  elapsedMs: number;
  durationMs: number;
  error?: string;
}

interface AudioElementLike {
  src: string;
  currentTime: number;
  duration: number;
  preload: string;
  onloadedmetadata: ((this: any, event: any) => any) | null;
  ontimeupdate: ((this: any, event: any) => any) | null;
  onplay: ((this: any, event: any) => any) | null;
  onpause: ((this: any, event: any) => any) | null;
  onended: ((this: any, event: any) => any) | null;
  onerror: ((this: any, event: any) => any) | null;
  play(): Promise<void>;
  pause(): void;
  load(): void;
}

interface ObjectUrlAdapter {
  createObjectURL(blob: Blob): string;
  revokeObjectURL(url: string): void;
}

/** One controlled player for all recordings in the currently loaded page. */
export class AudioPlaybackController {
  private readonly audio: AudioElementLike;
  private readonly urls: ObjectUrlAdapter;
  private objectUrl: string | null = null;
  private state: AudioPlaybackState = { activeNoteId: null, status: 'idle', elapsedMs: 0, durationMs: 0 };
  private readonly listeners = new Set<(state: AudioPlaybackState) => void>();

  constructor(audio: AudioElementLike, urls: ObjectUrlAdapter) {
    this.audio = audio;
    this.urls = urls;
    this.audio.preload = 'metadata';
    this.audio.onloadedmetadata = () => this.patch({ durationMs: Number.isFinite(this.audio.duration) ? this.audio.duration * 1000 : this.state.durationMs });
    this.audio.ontimeupdate = () => this.patch({ elapsedMs: Math.max(0, this.audio.currentTime * 1000) });
    this.audio.onplay = () => this.patch({ status: 'playing' });
    this.audio.onpause = () => { if (this.state.status === 'playing') this.patch({ status: 'paused' }); };
    this.audio.onended = () => this.patch({ status: 'ended', elapsedMs: this.state.durationMs });
    this.audio.onerror = () => this.patch({ status: 'error', error: 'This recording could not be played.' });
  }

  subscribe(listener: (state: AudioPlaybackState) => void): () => void {
    this.listeners.add(listener);
    listener({ ...this.state });
    return () => this.listeners.delete(listener);
  }

  getState(): AudioPlaybackState { return { ...this.state }; }

  async play(noteId: string, blob?: Blob, fallbackDurationMs = 0): Promise<void> {
    if (this.state.activeNoteId !== noteId) {
      if (!blob) throw new Error('Audio bytes are required when switching recordings.');
      // Detach the media element before revoking its previous source. Revoking
      // first races Chromium's decoder and produces "no supported source".
      this.audio.pause();
      this.audio.src = '';
      this.audio.load();
      this.releaseSource();
      this.objectUrl = this.urls.createObjectURL(blob);
      this.audio.src = this.objectUrl;
      this.state = { activeNoteId: noteId, status: 'loading', elapsedMs: 0, durationMs: fallbackDurationMs };
      this.emit();
      this.audio.load();
    }
    try {
      await this.audio.play();
      this.patch({ status: 'playing', error: undefined });
    } catch (error) {
      this.patch({ status: 'error', error: error instanceof Error ? error.message : 'This recording could not be played.' });
      throw error;
    }
  }

  pause(): void { this.audio.pause(); this.patch({ status: 'paused' }); }

  async resume(): Promise<void> {
    if (!this.state.activeNoteId) return;
    await this.audio.play();
    this.patch({ status: 'playing', error: undefined });
  }

  seek(milliseconds: number): void {
    const maximum = this.state.durationMs > 0 ? this.state.durationMs : Number.POSITIVE_INFINITY;
    const next = Math.max(0, Math.min(milliseconds, maximum));
    this.audio.currentTime = next / 1000;
    this.patch({ elapsedMs: next, status: this.state.status === 'ended' ? 'paused' : this.state.status });
  }

  clear(): void {
    this.audio.pause();
    this.audio.src = '';
    this.audio.load();
    this.releaseSource();
    this.state = { activeNoteId: null, status: 'idle', elapsedMs: 0, durationMs: 0 };
    this.emit();
  }

  destroy(): void {
    this.clear();
    this.audio.onloadedmetadata = null;
    this.audio.ontimeupdate = null;
    this.audio.onplay = null;
    this.audio.onpause = null;
    this.audio.onended = null;
    this.audio.onerror = null;
    this.listeners.clear();
  }

  private releaseSource(): void {
    if (!this.objectUrl) return;
    this.urls.revokeObjectURL(this.objectUrl);
    this.objectUrl = null;
  }

  private patch(update: Partial<AudioPlaybackState>): void {
    this.state = { ...this.state, ...update };
    this.emit();
  }

  private emit(): void { this.listeners.forEach(listener => listener({ ...this.state })); }
}
