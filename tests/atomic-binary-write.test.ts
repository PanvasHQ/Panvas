import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import os from 'node:os';
import { mkdtemp, readFile, readdir, rm, writeFile, mkdir } from 'node:fs/promises';
import { WriteQueue } from '../electron/ipc/write-queue.ts';

test('atomic queue serializes concurrent binary writes and leaves no temp artifact', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'panvas-atomic-'));
  try {
    const target = path.join(root, 'asset.bin');
    const queue = new WriteQueue();
    await Promise.all([queue.enqueue(target, new Uint8Array([1, 1, 1])), queue.enqueue(target, new Uint8Array([2, 2, 2])), queue.enqueue(target, new Uint8Array([3, 3, 3]))]);
    assert.deepEqual([...await readFile(target)], [3, 3, 3]);
    assert.deepEqual((await readdir(root)).filter(name => name.includes('.tmp-')), []);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('a failed staged write preserves the prior valid final binary', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'panvas-atomic-fail-'));
  try {
    const target = path.join(root, 'asset.bin');
    await writeFile(target, new Uint8Array([9, 8, 7]));
    await mkdir(`${target}.tmp-${process.pid}-1`);
    const queue = new WriteQueue();
    await assert.rejects(queue.enqueue(target, new Uint8Array([0, 0, 0])));
    assert.deepEqual([...await readFile(target)], [9, 8, 7]);
  } finally { await rm(root, { recursive: true, force: true }); }
});
