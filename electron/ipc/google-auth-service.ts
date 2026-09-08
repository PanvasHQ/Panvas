import http from 'http';
import path from 'path';
import fs from 'fs/promises';
import dotenv from 'dotenv';
import type { ProviderConnectionInfo } from '../../src/services/cloudsync/types';
import { generateRandomString, generateCodeChallenge } from '../../src/services/cloudsync/pkce.ts';

export { generateRandomString, generateCodeChallenge };

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp in ms
  accountIdentifier: string;
  displayName?: string;
  email?: string;
  connectedAt: number;
}

export interface GoogleAuthServiceOptions {
  tokenFilePath?: string;
  tokenEndpoint?: string;
  authEndpoint?: string;
  revokeEndpoint?: string;
  userinfoEndpoint?: string;
  fetchFn?: typeof fetch;
  clientId?: string;
  clientSecret?: string;
}

export class GoogleAuthDiagnosticError extends Error {
  readonly stage: string;
  readonly status?: number;
  readonly reason: string;
  readonly publicMessage: string;
  constructor(input: { stage: string; reason: string; status?: number; publicMessage?: string }) {
    super('Google authorization operation failed.');
    this.name = 'GoogleAuthDiagnosticError';
    this.stage = input.stage; this.reason = input.reason; this.status = input.status;
    this.publicMessage = input.publicMessage ?? "Google Drive couldn't be connected. Please try again.";
  }
}

function ensureEnvLoaded(): void {
  try {
    dotenv.config({ path: path.join(process.cwd(), '.env') });
    dotenv.config({ path: path.join(process.cwd(), '.env.local') });
    if (process.env.APP_ROOT && process.env.APP_ROOT !== process.cwd()) {
      dotenv.config({ path: path.join(process.env.APP_ROOT, '.env') });
      dotenv.config({ path: path.join(process.env.APP_ROOT, '.env.local') });
    }
  } catch {
    // Graceful fallback if files or dotenv are unavailable
  }
}

const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke';
const GOOGLE_USERINFO_ENDPOINT = 'https://www.googleapis.com/drive/v3/about?fields=user(permissionId,displayName,emailAddress)';

const SCOPES = 'https://www.googleapis.com/auth/drive.file';

async function getElectronModule() {
  try {
    return await import('electron');
  } catch {
    return null;
  }
}

export class GoogleAuthService {
  private tokenFilePath: string;
  private tokenEndpoint: string;
  private authEndpoint: string;
  private revokeEndpoint: string;
  private userinfoEndpoint: string;
  private fetchFn: typeof fetch;
  private defaultClientId?: string;
  private defaultClientSecret?: string;

  constructor(options: GoogleAuthServiceOptions = {}) {
    this.tokenFilePath = options.tokenFilePath || '';
    this.tokenEndpoint = options.tokenEndpoint || GOOGLE_TOKEN_ENDPOINT;
    this.authEndpoint = options.authEndpoint || GOOGLE_AUTH_ENDPOINT;
    this.revokeEndpoint = options.revokeEndpoint || GOOGLE_REVOKE_ENDPOINT;
    this.userinfoEndpoint = options.userinfoEndpoint || GOOGLE_USERINFO_ENDPOINT;
    this.fetchFn = options.fetchFn || globalThis.fetch.bind(globalThis);
    this.defaultClientId = options.clientId;
    this.defaultClientSecret = options.clientSecret;
  }

  private resolveClientId(custom?: string): string {
    if (custom !== undefined) return custom.trim();
    if (this.defaultClientId !== undefined) return this.defaultClientId.trim();
    ensureEnvLoaded();
    return (process.env.PANVAS_GOOGLE_CLIENT_ID || '').trim();
  }

  private resolveClientSecret(custom?: string): string {
    if (custom !== undefined) return custom.trim();
    if (this.defaultClientSecret !== undefined) return this.defaultClientSecret.trim();
    ensureEnvLoaded();
    // Accept the historical short name as well; keep the secret main-process only.
    return (process.env.PANVAS_GOOGLE_CLIENT_SECRET || process.env.PANVAS_GOOGLE_SECRET || '').trim();
  }

  private async resolveTokenFilePath(): Promise<string> {
    if (this.tokenFilePath) return this.tokenFilePath;
    const electron = await getElectronModule();
    if (electron?.app?.getPath) {
      this.tokenFilePath = path.join(electron.app.getPath('userData'), 'google_auth_tokens.enc');
      return this.tokenFilePath;
    }
    if (process.env.APPDATA) {
      this.tokenFilePath = path.join(process.env.APPDATA, 'Panvas', 'google_auth_tokens.enc');
      return this.tokenFilePath;
    }
    return '';
  }

  /**
   * Starts the Google OAuth 2.0 PKCE flow on the system browser via loopback server.
   */
  async startAuthFlow(customClientId?: string, customClientSecret?: string): Promise<ProviderConnectionInfo> {
    const clientId = this.resolveClientId(customClientId);
    const clientSecret = this.resolveClientSecret(customClientSecret);

    if (!clientId) {
      throw new GoogleAuthDiagnosticError({ stage: 'configuration', reason: 'missing_client_id', publicMessage: 'Google Drive sign-in is temporarily unavailable.' });
    }

    const codeVerifier = generateRandomString(48);
    const codeChallenge = generateCodeChallenge(codeVerifier);
    const state = generateRandomString(24);

    return new Promise((resolve, reject) => {
      let resolved = false;

      // Start loopback HTTP server on an available port
      const server = http.createServer(async (req, res) => {
        try {
          const reqUrl = new URL(req.url || '/', `http://${req.headers.host}`);
          if (reqUrl.pathname !== '/oauth2callback') {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found');
            return;
          }

          const errorParam = reqUrl.searchParams.get('error');
          if (errorParam) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(this.renderHtmlResponse(false, "Google Drive couldn't be connected. Please return to Panvas and try again."));
            cleanup();
            if (!resolved) {
              resolved = true;
              reject(new GoogleAuthDiagnosticError({ stage: 'authorization_callback', reason: errorParam }));
            }
            return;
          }

          const incomingState = reqUrl.searchParams.get('state');
          const code = reqUrl.searchParams.get('code');

          if (incomingState !== state || !code) {
            res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(this.renderHtmlResponse(false, 'Invalid state or missing authorization code.'));
            cleanup();
            if (!resolved) {
              resolved = true;
              reject(new GoogleAuthDiagnosticError({ stage: 'authorization_callback', reason: 'invalid_state' }));
            }
            return;
          }

          // Exchange code for tokens (includes client_secret if configured)
          const tokens = await this.exchangeCodeForTokens({
            clientId,
            clientSecret,
            code,
            codeVerifier,
            redirectUri: `http://127.0.0.1:${port}/oauth2callback`,
          });

          // Fetch user info for UI presentation
          const userInfo = await this.fetchUserInfo(tokens.access_token);

          const storedData: StoredTokens = {
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token || '',
            expiresAt: Date.now() + tokens.expires_in * 1000,
            accountIdentifier: userInfo.id || userInfo.email || 'google-user',
            displayName: userInfo.name,
            email: userInfo.email,
            connectedAt: Date.now(),
          };

          await this.saveTokens(storedData);

          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(this.renderHtmlResponse(true, 'Google Drive connected successfully!'));

          cleanup();
          if (!resolved) {
            resolved = true;
            resolve({
              provider: 'googledrive',
              accountIdentifier: storedData.accountIdentifier,
              displayName: storedData.displayName,
              email: storedData.email,
              connectedAt: storedData.connectedAt,
            });
          }
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
          const publicMessage = err instanceof GoogleAuthDiagnosticError ? err.publicMessage : "Google Drive couldn't be connected. Please return to Panvas and try again.";
          res.end(this.renderHtmlResponse(false, publicMessage));
          cleanup();
          if (!resolved) {
            resolved = true;
            reject(err);
          }
        }
      });

      let port = 0;

      server.listen(0, '127.0.0.1', async () => {
        const address = server.address();
        if (!address || typeof address === 'string') {
          cleanup();
          reject(new GoogleAuthDiagnosticError({ stage: 'loopback_server', reason: 'server_start_failed' }));
          return;
        }

        port = address.port;
        const redirectUri = `http://127.0.0.1:${port}/oauth2callback`;

        const authParams = new URLSearchParams({
          client_id: clientId,
          redirect_uri: redirectUri,
          response_type: 'code',
          scope: SCOPES,
          code_challenge: codeChallenge,
          code_challenge_method: 'S256',
          state,
          access_type: 'offline',
          prompt: 'consent',
        });

        const authUrl = `${this.authEndpoint}?${authParams.toString()}`;
        const electron = await getElectronModule();
        if (electron?.shell?.openExternal) {
          void electron.shell.openExternal(authUrl);
        }
      });

      const timeout = setTimeout(() => {
        cleanup();
        if (!resolved) {
          resolved = true;
          reject(new GoogleAuthDiagnosticError({ stage: 'authorization', reason: 'timeout' }));
        }
      }, 120_000); // 2 minute timeout

      const cleanup = () => {
        clearTimeout(timeout);
        try {
          server.close();
        } catch {
          // ignore close errors
        }
      };
    });
  }

  /**
   * Reads stored connection info (without exposing secret access tokens).
   */
  async getConnectionInfo(): Promise<ProviderConnectionInfo | null> {
    const stored = await this.readStoredTokens();
    if (!stored) return null;
    return {
      provider: 'googledrive',
      accountIdentifier: stored.accountIdentifier,
      displayName: stored.displayName,
      email: stored.email,
      connectedAt: stored.connectedAt,
    };
  }

  /**
   * Retrieves a valid access token, automatically refreshing it if expired.
   */
  async getValidAccessToken(customClientId?: string, customClientSecret?: string): Promise<string | null> {
    const stored = await this.readStoredTokens();
    if (!stored) return null;

    // If access token is still valid (with 60s margin), use it
    if (Date.now() < stored.expiresAt - 60_000) {
      return stored.accessToken;
    }

    // Refresh if refresh token exists
    if (!stored.refreshToken) {
      return null;
    }

    const clientId = this.resolveClientId(customClientId);
    const clientSecret = this.resolveClientSecret(customClientSecret);
    if (!clientId) return null;

    try {
      const refreshed = await this.refreshAccessToken(clientId, stored.refreshToken, clientSecret);
      stored.accessToken = refreshed.access_token;
      stored.expiresAt = Date.now() + refreshed.expires_in * 1000;
      if (refreshed.refresh_token) {
        stored.refreshToken = refreshed.refresh_token;
      }
      await this.saveTokens(stored);
      return stored.accessToken;
    } catch (err) {
      const diagnostic = err instanceof GoogleAuthDiagnosticError
        ? { provider: 'googledrive', stage: err.stage, status: err.status, reason: err.reason, retryable: false }
        : { provider: 'googledrive', stage: 'token_refresh', reason: (err as Error)?.name || 'unknown', retryable: false };
      return null;
    }
  }

  /** Force refresh after Drive rejects an otherwise locally unexpired token. */
  async forceRefreshAccessToken(customClientId?: string, customClientSecret?: string): Promise<string | null> {
    const stored = await this.readStoredTokens();
    if (!stored?.refreshToken) return null;
    const clientId = this.resolveClientId(customClientId);
    if (!clientId) return null;
    try {
      const refreshed = await this.refreshAccessToken(clientId, stored.refreshToken, this.resolveClientSecret(customClientSecret));
      stored.accessToken = refreshed.access_token;
      stored.expiresAt = Date.now() + refreshed.expires_in * 1000;
      if (refreshed.refresh_token) stored.refreshToken = refreshed.refresh_token;
      await this.saveTokens(stored);
      return stored.accessToken;
    } catch {
      return null;
    }
  }

  /**
   * Disconnects Google Drive by revoking tokens and deleting encrypted storage.
   */
  async disconnect(): Promise<void> {
    const stored = await this.readStoredTokens();
    if (stored?.refreshToken || stored?.accessToken) {
      try {
        const tokenToRevoke = stored.refreshToken || stored.accessToken;
        await this.fetchFn(`${this.revokeEndpoint}?token=${encodeURIComponent(tokenToRevoke)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
      } catch {
        // Revocation network errors do not block local token cleanup
      }
    }
    await this.deleteTokens();
  }

  /**
   * Exchanges an authorization code for access and refresh tokens.
   * Includes `client_secret` in the POST body if configured (required by Google Desktop OAuth clients).
   */
  async exchangeCodeForTokens(input: {
    clientId: string;
    clientSecret?: string;
    code: string;
    codeVerifier: string;
    redirectUri: string;
  }): Promise<{ access_token: string; refresh_token?: string; expires_in: number }> {
    const params = new URLSearchParams({
      client_id: input.clientId,
      code: input.code,
      code_verifier: input.codeVerifier,
      grant_type: 'authorization_code',
      redirect_uri: input.redirectUri,
    });

    if (input.clientSecret) {
      params.set('client_secret', input.clientSecret);
    }

    const response = await this.fetchFn(this.tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      const reason = await this.readProviderReason(response);
      throw new GoogleAuthDiagnosticError({ stage: 'token_exchange', status: response.status, reason });
    }

    return response.json() as Promise<{ access_token: string; refresh_token?: string; expires_in: number }>;
  }

  /**
   * Refreshes an expired access token using the stored refresh token.
   * Includes `client_secret` in the POST body if configured.
   */
  async refreshAccessToken(
    clientId: string,
    refreshToken: string,
    clientSecret?: string,
  ): Promise<{ access_token: string; refresh_token?: string; expires_in: number }> {
    const params = new URLSearchParams({
      client_id: clientId,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    if (clientSecret) {
      params.set('client_secret', clientSecret);
    }

    const response = await this.fetchFn(this.tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      const reason = await this.readProviderReason(response);
      throw new GoogleAuthDiagnosticError({ stage: 'token_refresh', status: response.status, reason, publicMessage: 'Google Drive needs to be reconnected.' });
    }

    return response.json() as Promise<{ access_token: string; refresh_token?: string; expires_in: number }>;
  }

  async fetchUserInfo(accessToken: string): Promise<{ id?: string; email?: string; name?: string }> {
    try {
      const response = await this.fetchFn(this.userinfoEndpoint, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (response.ok) {
        const value = await response.json() as { user?: { permissionId?: string; emailAddress?: string; displayName?: string } };
        return { id: value.user?.permissionId ?? value.user?.emailAddress, email: value.user?.emailAddress, name: value.user?.displayName };
      }
    } catch {
      // Userinfo fetch failure is non-fatal
    }
    return {};
  }

  private async readProviderReason(response: Response): Promise<string> {
    try {
      const text = await response.text();
      const parsed = text ? JSON.parse(text) : null;
      const reason = typeof parsed?.error === 'string'
        ? parsed.error
        : parsed?.error?.status ?? parsed?.error?.errors?.[0]?.reason ?? response.statusText ?? 'provider_error';
      return String(reason).replace(/[^a-zA-Z0-9_.:-]+/g, '_').slice(0, 80);
    } catch { return String(response.statusText || 'provider_error').replace(/[^a-zA-Z0-9_.:-]+/g, '_').slice(0, 80); }
  }

  private async saveTokens(tokens: StoredTokens): Promise<void> {
    const filePath = await this.resolveTokenFilePath();
    if (!filePath) return;
    const json = JSON.stringify(tokens);
    let payload: Buffer;
    const electron = await getElectronModule();
    if (electron?.safeStorage?.isEncryptionAvailable?.()) {
      payload = electron.safeStorage.encryptString(json);
    } else {
      throw new GoogleAuthDiagnosticError({ stage: 'secure_storage', reason: 'secure_storage_unavailable', publicMessage: "Google Drive couldn't be connected. Please try again." });
    }
    await fs.writeFile(filePath, payload);
  }

  private async readStoredTokens(): Promise<StoredTokens | null> {
    const filePath = await this.resolveTokenFilePath();
    if (!filePath) return null;
    try {
      const data = await fs.readFile(filePath);
      let json: string;
      const electron = await getElectronModule();
      if (!electron?.safeStorage?.isEncryptionAvailable?.()) return null;
      try { json = electron.safeStorage.decryptString(data); } catch { return null; }
      return JSON.parse(json);
    } catch {
      return null;
    }
  }

  private async deleteTokens(): Promise<void> {
    const filePath = await this.resolveTokenFilePath();
    if (!filePath) return;
    try {
      await fs.unlink(filePath);
    } catch {
      // File may already not exist
    }
  }

  private renderHtmlResponse(success: boolean, message: string): string {
    const title = success ? 'Connected to Panvas' : 'Connection Error';
    const accentColor = success ? '#0F9D58' : '#EA4335';
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #0f141c;
      color: #f1f5f9;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 20px;
    }
    .card {
      background: #182232;
      border: 1px solid #2b394e;
      border-radius: 16px;
      padding: 32px 28px;
      max-width: 420px;
      text-align: center;
      box-shadow: 0 10px 25px rgba(0,0,0,0.4);
    }
    .icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: ${accentColor}20;
      color: ${accentColor};
      font-size: 28px;
      margin-bottom: 20px;
    }
    h1 {
      font-size: 20px;
      font-weight: 600;
      margin: 0 0 10px 0;
    }
    p {
      font-size: 14px;
      color: #94a3b8;
      margin: 0 0 20px 0;
      line-height: 1.5;
    }
    .hint {
      font-size: 12px;
      color: #64748b;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${success ? '✓' : '✕'}</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <div class="hint">You can safely close this window and return to Panvas.</div>
  </div>
</body>
</html>`;
  }
}

export const googleAuthService = new GoogleAuthService();
