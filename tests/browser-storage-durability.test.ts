import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateBrowserStorageDurability, getBrowserStorageDurabilityState, initializeBrowserStorageDurability, resetBrowserStorageDurabilityForTests } from '../src/services/storage/browserStorageDurability.ts';

test('browser storage reports an existing persistent grant and quota estimate', async () => {
  const result = await evaluateBrowserStorageDurability({ persisted: async () => true, persist: async () => { throw new Error('must not request twice'); }, estimate: async () => ({ usage: 128, quota: 1024 }) });
  assert.equal(result.persistence, 'already-persisted');
  assert.deepEqual(result.estimate, { usage: 128, quota: 1024 });
  assert.equal(result.editingEnabled, true);
});

test('browser storage requests persistence when not already persisted', async () => {
  let requests = 0;
  const granted = await evaluateBrowserStorageDurability({ persisted: async () => false, persist: async () => { requests++; return true; } });
  assert.equal(granted.persistence, 'granted');
  assert.equal(requests, 1);
  const denied = await evaluateBrowserStorageDurability({ persisted: async () => false, persist: async () => false });
  assert.equal(denied.persistence, 'denied');
  assert.equal(denied.editingEnabled, true, 'denial must never disable editing');
  assert.match(denied.message, /backups|desktop/i);
});

test('unsupported and unavailable storage APIs remain non-blocking', async () => {
  for (const storage of [undefined, {}]) {
    const result = await evaluateBrowserStorageDurability(storage);
    assert.equal(result.persistence, 'unsupported');
    assert.equal(result.editingEnabled, true);
    assert.deepEqual(result.estimate, { usage: null, quota: null });
  }
});

test('persistence and estimate exceptions are sanitized and do not crash', async () => {
  const secret = 'raw-browser-secret';
  const result = await evaluateBrowserStorageDurability({ persisted: async () => { throw new Error(secret); }, persist: async () => { throw new Error(secret); }, estimate: async () => { throw new Error(secret); } });
  assert.equal(result.persistence, 'error');
  assert.equal(result.editingEnabled, true);
  assert.deepEqual(result.estimate, { usage: null, quota: null });
  assert.doesNotMatch(result.message, new RegExp(secret));
});

test('navigator-unavailable initialization is safe and represented in shared state', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  try {
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: undefined });
    resetBrowserStorageDurabilityForTests();
    const result = await initializeBrowserStorageDurability();
    assert.equal(result.persistence, 'unsupported');
    assert.deepEqual(getBrowserStorageDurabilityState(), result);
  } finally {
    resetBrowserStorageDurabilityForTests();
    if (descriptor) Object.defineProperty(globalThis, 'navigator', descriptor); else delete (globalThis as any).navigator;
  }
});

test('a failed persisted probe still permits a successful request', async () => {
  const result = await evaluateBrowserStorageDurability({ persisted: async () => { throw new Error('probe unavailable'); }, persist: async () => true, estimate: async () => ({ usage: Number.NaN, quota: -1 }) });
  assert.equal(result.persistence, 'granted');
  assert.deepEqual(result.estimate, { usage: null, quota: null });
});
