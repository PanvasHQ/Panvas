/**
 * RFC 7636 PKCE (Proof Key for Code Exchange) utilities for OAuth 2.0.
 */

import crypto from 'crypto';

/** Helper to generate base64url-encoded random bytes */
export function generateRandomString(byteLength = 32): string {
  if (typeof crypto !== 'undefined' && crypto.randomBytes) {
    return crypto.randomBytes(byteLength).toString('base64url');
  }
  // Browser fallback
  const array = new Uint8Array(byteLength);
  globalThis.crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Helper to compute SHA-256 code challenge for PKCE (S256) */
export function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}
