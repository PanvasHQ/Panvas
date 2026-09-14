import type { ProviderConnectionInfo } from './types.ts';
import { CloudOperationError } from './errors.ts';

const GIS_SRC = 'https://accounts.google.com/gsi/client';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

interface BrowserToken { accessToken: string; expiresAt: number; connection: ProviderConnectionInfo }
let current: BrowserToken | null = null;
let scriptPromise: Promise<void> | null = null;

function webClientId(): string {
  const meta = (typeof import.meta !== 'undefined' && (import.meta as any).env) ? (import.meta as any).env : {} as Record<string, string | undefined>;
  return (meta.VITE_PANVAS_GOOGLE_WEB_CLIENT_ID || '').trim();
}

export function isBrowserGoogleConfigured(): boolean { return webClientId().length > 0; }

export function preloadGis(): Promise<void> {
  if (typeof document === 'undefined') return Promise.resolve();
  if ((globalThis as any).google?.accounts?.oauth2) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`);
    if (existing) {
      if ((globalThis as any).google?.accounts?.oauth2) { resolve(); return; }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => { scriptPromise = null; reject(new CloudOperationError('connection', { stage: 'gis_load', reason: 'script_unavailable', retryable: true })); }, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener('error', () => { scriptPromise = null; reject(new CloudOperationError('connection', { stage: 'gis_load', reason: 'script_unavailable', retryable: true })); }, { once: true });
    document.head.appendChild(script);
  });
  return scriptPromise;
}

async function fetchAccount(accessToken: string): Promise<{ id: string; email?: string; name?: string }> {
  const response = await fetch('https://www.googleapis.com/drive/v3/about?fields=user(permissionId,displayName,emailAddress)', { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new CloudOperationError('connection', { stage: 'account_identity', status: response.status, reason: 'userinfo_unavailable', retryable: response.status >= 500 });
  const value = await response.json();
  const id = value?.user?.permissionId || value?.user?.emailAddress;
  if (!id) throw new CloudOperationError('connection', { stage: 'account_identity', reason: 'userinfo_identity_missing', retryable: false });
  return { id: String(id), email: value.user?.emailAddress, name: value.user?.displayName };
}

export function requestBrowserGoogleAccessToken(clientId: string, oauth2: any = (globalThis as any).google?.accounts?.oauth2): Promise<any> {
  if (!oauth2?.initTokenClient) {
    return Promise.reject(new CloudOperationError('connection', { stage: 'gis_load', reason: 'oauth2_unavailable', retryable: true }));
  }
  return new Promise((resolve, reject) => {
    try {
      const tokenClient = oauth2.initTokenClient({
        client_id: clientId,
        scope: DRIVE_SCOPE,
        callback: (response: any) => {
          if (response?.access_token) resolve(response);
          else reject(new CloudOperationError('connection', { stage: 'gis_token', reason: response?.error ? 'token_rejected' : 'token_missing', retryable: true }));
        },
        error_callback: () => reject(new CloudOperationError('connection', { stage: 'gis_popup', reason: 'popup_failed', retryable: true })),
      });
      tokenClient.requestAccessToken();
    } catch {
      reject(new CloudOperationError('connection', { stage: 'gis_token', reason: 'token_request_failed', retryable: true }));
    }
  });
}

export async function connectBrowserGoogle(): Promise<ProviderConnectionInfo> {
  const clientId = webClientId();
  if (!clientId) throw new CloudOperationError('configuration', { stage: 'configuration', reason: 'missing_web_client_id', retryable: false });
  await preloadGis();
  const tokenResponse = await requestBrowserGoogleAccessToken(clientId);
  const account = await fetchAccount(tokenResponse.access_token);
  const connection: ProviderConnectionInfo = { provider: 'googledrive', accountIdentifier: account.id, displayName: account.name, email: account.email, connectedAt: Date.now() };
  current = { accessToken: tokenResponse.access_token, expiresAt: Date.now() + Math.max(60, Number(tokenResponse.expires_in ?? 3600) - 60) * 1000, connection };
  return connection;
}

export async function getBrowserGoogleToken(): Promise<string | null> {
  // Keep the non-secret connection identity long enough for GIS to renew an
  // expired memory-only token and verify that the account did not change.
  if (!current || current.expiresAt <= Date.now()) return null;
  return current.accessToken;
}

/** Re-authorize an access token after Drive rejects it. GIS browser tokens
 * remain memory-only, and the established account must not change silently. */
export async function refreshBrowserGoogleToken(): Promise<string | null> {
  const previous = current?.connection;
  const clientId = webClientId();
  if (!previous || !clientId) return null;
  try {
    await preloadGis();
    const tokenResponse = await requestBrowserGoogleAccessToken(clientId);
    const account = await fetchAccount(tokenResponse.access_token);
    if (current?.connection !== previous) return null;
    const sameAccount = account.id === previous.accountIdentifier
      || Boolean(previous.email && account.email && previous.email.toLowerCase() === account.email.toLowerCase());
    if (!sameAccount) return null;
    current = {
      accessToken: tokenResponse.access_token,
      expiresAt: Date.now() + Math.max(60, Number(tokenResponse.expires_in ?? 3600) - 60) * 1000,
      connection: { ...previous, accountIdentifier: account.id, displayName: account.name ?? previous.displayName, email: account.email ?? previous.email },
    };
    return current.accessToken;
  } catch {
    return null;
  }
}

export function getBrowserGoogleConnection(): ProviderConnectionInfo | null { return current?.connection ?? null; }

export async function disconnectBrowserGoogle(): Promise<void> {
  const token = current?.accessToken;
  current = null;
  if (token && (globalThis as any).google?.accounts?.oauth2?.revoke) {
    await new Promise<void>(resolve => (globalThis as any).google.accounts.oauth2.revoke(token, () => resolve()));
  }
}
