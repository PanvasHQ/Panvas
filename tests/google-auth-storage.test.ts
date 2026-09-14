import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { GoogleAuthService, resolveGoogleTokenFilePath } from '../electron/ipc/google-auth-service.ts';

test('Google token fallback paths are platform-safe and outside workspace storage', () => {
  assert.equal(resolveGoogleTokenFilePath('win32', { APPDATA: 'C:\\Users\\Example\\AppData\\Roaming' }), path.win32.join('C:\\Users\\Example\\AppData\\Roaming', 'Panvas', 'google_auth_tokens.enc'));
  assert.equal(resolveGoogleTokenFilePath('win32', { USERPROFILE: 'C:\\Users\\Example' }), path.win32.join('C:\\Users\\Example', 'AppData', 'Roaming', 'Panvas', 'google_auth_tokens.enc'));
  assert.equal(resolveGoogleTokenFilePath('darwin', { HOME: '/Users/example' }), path.posix.join('/Users/example', 'Library', 'Application Support', 'Panvas', 'google_auth_tokens.enc'));
  assert.equal(resolveGoogleTokenFilePath('linux', { HOME: '/home/example' }), path.posix.join('/home/example', '.config', 'Panvas', 'google_auth_tokens.enc'));
  assert.equal(resolveGoogleTokenFilePath('linux', { HOME: '/home/example', XDG_CONFIG_HOME: '/var/example-config' }), path.posix.join('/var/example-config', 'Panvas', 'google_auth_tokens.enc'));
  for (const platform of ['win32', 'darwin', 'linux'] as const) {
    assert.doesNotMatch(resolveGoogleTokenFilePath(platform, { HOME: '/owner', USERPROFILE: 'C:\\owner', APPDATA: 'C:\\owner\\roaming' }), /Documents[\\/]Panvas/);
  }
});

test('OAuth failures do not log authorization codes, client secrets, or provider token payloads', async () => {
  const captured: unknown[][] = [];
  const originals = [console.log, console.warn, console.error];
  console.log = (...args) => { captured.push(args); };
  console.warn = (...args) => { captured.push(args); };
  console.error = (...args) => { captured.push(args); };
  try {
    const service = new GoogleAuthService({
      fetchFn: async () => new Response(JSON.stringify({ error: 'invalid_grant', access_token: 'provider-access-token' }), { status: 400 }),
    });
    await assert.rejects(service.exchangeCodeForTokens({ clientId: 'client-id', clientSecret: 'client-secret', code: 'authorization-code', codeVerifier: 'verifier', redirectUri: 'http://127.0.0.1/callback' }));
    const output = JSON.stringify(captured);
    assert.doesNotMatch(output, /provider-access-token|client-secret|authorization-code/);
  } finally {
    [console.log, console.warn, console.error] = originals;
  }
});

test('OAuth callback embeds the canonical Panvas mark used by the application shell', async () => {
  const service = new GoogleAuthService();
  const renderHtmlResponse = (service as unknown as {
    renderHtmlResponse: (success: boolean, message: string) => Promise<string>;
  }).renderHtmlResponse.bind(service);
  const html = await renderHtmlResponse(true, 'Google Drive connected successfully!');
  const logo = await fs.readFile(path.join(process.cwd(), 'public', 'panvas_logo.png'));
  const dataUri = `data:image/png;base64,${logo.toString('base64')}`;

  assert.equal(html.includes(`<img class="brand-mark" src="${dataUri}" alt="Panvas">`), true);
  assert.doesNotMatch(html, /<svg viewBox="0 0 32 32" role="img" aria-label="Panvas">/);
});
