/**
 * Content hashing for the sync core. SHA-256 via WebCrypto in the browser /
 * Electron renderer, node:crypto in tests/Node. Canonical JSON input must be
 * produced by canonicalizeJson BEFORE hashing (stable key order) so hashes
 * are deterministic across platforms.
 */

export async function sha256Hex(input: string): Promise<string> {
  return sha256Bytes(new TextEncoder().encode(input));
}

/** SHA-256 for the exact bytes stored in the content-addressed object. */
export async function sha256Bytes(input: Uint8Array): Promise<string> {
  const globalCrypto = typeof globalThis !== 'undefined'
    ? ((globalThis as { crypto?: { subtle?: SubtleCrypto } }).crypto?.subtle ?? null)
    : null;
  if (globalCrypto) {
    const digest = await globalCrypto.digest('SHA-256', input as BufferSource);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  }
  const { createHash } = await import('node:crypto');
  return createHash('sha256').update(input).digest('hex');
}

/** Deterministic JSON: recursively sorted object keys, no whitespace. */
export function canonicalizeJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalizeJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, member]) => member !== undefined)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
  return `{${entries.map(([key, member]) => `${JSON.stringify(key)}:${canonicalizeJson(member)}`).join(',')}}`;
}

export async function hashCanonical(value: unknown): Promise<string> {
  return sha256Hex(canonicalizeJson(value));
}
