import type { CloudSyncStatus, SafeCloudDiagnostic, SyncEntityKind } from './types.ts';

export type CloudErrorCode = 'configuration' | 'connection' | 'offline' | 'auth-expired' | 'rate-limited' | 'conflict' | 'review' | 'payload' | 'remote-workspace' | 'account-migration-required' | 'sync';

const PUBLIC_MESSAGES: Record<CloudErrorCode, string> = {
  configuration: 'Google Drive needs to be reconnected.',
  connection: 'Google Drive needs to be reconnected.',
  offline: "You're offline. Changes will sync when you're back online.",
  'auth-expired': 'Google Drive needs to be reconnected.',
  'rate-limited': "Couldn't sync. Your local data is safe.",
  conflict: "Couldn't sync. Your local data is safe.",
  review: 'Synced - changes need review. Your work was preserved.',
  payload: "Couldn't sync. Your local data is safe.",
  'remote-workspace': "Couldn't sync. Your local data is safe.",
  'account-migration-required': 'Some workspaces are linked to another Google account.',
  sync: "Couldn't sync. Your local data is safe.",
};

function safeAtom(value: unknown, fallback: string): string {
  const normalized = String(value ?? '').trim().replace(/[^a-zA-Z0-9_.:-]+/g, '_').slice(0, 80);
  return normalized || fallback;
}

const ENTITY_KINDS = new Set<SyncEntityKind>(['workspace', 'folder', 'notebook', 'notebookSection', 'notebookPage', 'pageContent', 'pageDrawing', 'canvasFile', 'canvasScene', 'customBlock', 'asset']);

/** Allowlisted diagnostic boundary shared by renderer logging and Electron IPC. */
export function sanitizeCloudDiagnostic(value: unknown): SafeCloudDiagnostic {
  const candidate = value && typeof value === 'object' ? value as Partial<SafeCloudDiagnostic> : {};
  const entityKind = ENTITY_KINDS.has(candidate.entityKind as SyncEntityKind) ? candidate.entityKind as SyncEntityKind : undefined;
  const status = typeof candidate.status === 'number' && Number.isInteger(candidate.status) && candidate.status >= 100 && candidate.status <= 599 ? candidate.status : undefined;
  return {
    provider: 'googledrive',
    workspaceId: candidate.workspaceId ? safeAtom(candidate.workspaceId, 'unknown') : undefined,
    stage: safeAtom(candidate.stage, 'unknown'),
    status,
    reason: safeAtom(candidate.reason, 'unknown'),
    entityKind,
    entityId: candidate.entityId ? safeAtom(candidate.entityId, 'unknown') : undefined,
    operation: candidate.operation ? safeAtom(candidate.operation, 'unknown') : undefined,
    retryable: Boolean(candidate.retryable),
  };
}

export class CloudOperationError extends Error {
  readonly code: CloudErrorCode;
  readonly diagnostic: SafeCloudDiagnostic;
  constructor(code: CloudErrorCode, diagnostic: Partial<SafeCloudDiagnostic> & Pick<SafeCloudDiagnostic, 'stage' | 'reason'>) {
    super(PUBLIC_MESSAGES[code]);
    this.name = 'CloudOperationError';
    this.code = code;
    this.diagnostic = sanitizeCloudDiagnostic({
      provider: 'googledrive', stage: safeAtom(diagnostic.stage, 'unknown'), reason: safeAtom(diagnostic.reason, 'unknown'),
      status: typeof diagnostic.status === 'number' ? diagnostic.status : undefined,
      workspaceId: diagnostic.workspaceId ? safeAtom(diagnostic.workspaceId, 'unknown') : undefined,
      entityKind: diagnostic.entityKind,
      entityId: diagnostic.entityId ? safeAtom(diagnostic.entityId, 'unknown') : undefined,
      operation: diagnostic.operation ? safeAtom(diagnostic.operation, 'unknown') : undefined,
      retryable: Boolean(diagnostic.retryable),
    });
  }
}

export interface CloudErrorPresentation {
  code: CloudErrorCode;
  message: string;
  status: CloudSyncStatus;
  diagnostic: SafeCloudDiagnostic;
}

export function publicCloudMessage(code: CloudErrorCode): string { return PUBLIC_MESSAGES[code]; }

export function presentCloudError(error: unknown, fallbackStage = 'sync'): CloudErrorPresentation {
  if (error instanceof CloudOperationError) return { code: error.code, message: PUBLIC_MESSAGES[error.code], status: statusFor(error.code), diagnostic: error.diagnostic };
  const candidate = error as { name?: string; status?: number; reason?: string; stage?: string; message?: string; workspaceId?: string; entityKind?: SyncEntityKind; entityType?: SyncEntityKind; entityId?: string; operation?: string };
  const name = safeAtom(candidate?.name, 'Error');
  const status = typeof candidate?.status === 'number' ? candidate.status : undefined;
  const internalMessage = String(candidate?.message ?? '');
  let code: CloudErrorCode = 'sync';
  if (name === 'AuthExpiredError' || status === 401) code = 'auth-expired';
  else if (name === 'RateLimitedError' || status === 429) code = 'rate-limited';
  else if (name === 'ProviderConflictError') code = 'conflict';
  else if (name === 'TypeError' || name === 'AbortError' || name === 'GoogleDriveTimeoutError') code = 'offline';
  else if (/PANVAS_GOOGLE_CLIENT_ID|client[_ ]?id.*not configured/i.test(internalMessage)) code = 'configuration';
  else if (/client_secret|invalid_request|authorization|oauth|sign-in/i.test(internalMessage)) code = 'connection';
  const diagnostic: SafeCloudDiagnostic = {
    provider: 'googledrive',
    workspaceId: candidate?.workspaceId ? safeAtom(candidate.workspaceId, 'unknown') : undefined,
    stage: safeAtom(candidate?.stage, fallbackStage),
    status,
    reason: safeAtom(candidate?.reason ?? name, 'unknown'),
    entityKind: candidate?.entityKind ?? candidate?.entityType,
    entityId: candidate?.entityId ? safeAtom(candidate.entityId, 'unknown') : undefined,
    operation: candidate?.operation ? safeAtom(candidate.operation, 'unknown') : undefined,
    retryable: code === 'offline' || code === 'rate-limited' || status === 408 || Boolean(status && status >= 500),
  };
  return { code, message: PUBLIC_MESSAGES[code], status: statusFor(code), diagnostic };
}

function statusFor(code: CloudErrorCode): CloudSyncStatus {
  if (code === 'offline') return 'offline';
  if (code === 'auth-expired') return 'auth-expired';
  if (code === 'rate-limited') return 'rate-limited';
  if (code === 'conflict') return 'conflict';
  if (code === 'review') return 'synced-review';
  if (code === 'account-migration-required') return 'account-migration-required';
  return 'error';
}

export function logCloudDiagnostic(diagnostic: SafeCloudDiagnostic): void {
  if (!(import.meta as any).env?.DEV) return;
  const safe = sanitizeCloudDiagnostic(diagnostic);
  const diagnosticBridge = (globalThis as typeof globalThis & { window?: { panvas?: { cloudsync?: { logDiagnostic?: (value: SafeCloudDiagnostic) => void } } } }).window?.panvas?.cloudsync?.logDiagnostic;
  if (diagnosticBridge) {
    diagnosticBridge(safe);
    return;
  }
  console.warn('[CloudSync diagnostic]', safe);
}
