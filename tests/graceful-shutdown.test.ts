import assert from 'node:assert/strict';
import test from 'node:test';
import os from 'node:os';
import path from 'node:path';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { GracefulShutdownController } from '../electron/graceful-shutdown.ts';
import { WriteQueue } from '../electron/ipc/write-queue.ts';

test('flush waits for one or multiple queued writes and an empty queue resolves', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'panvas-flush-'));
  try {
    const queue = new WriteQueue();
    await queue.flush();
    const first = path.join(root, 'first.json');
    const second = path.join(root, 'second.json');
    const writes = [queue.enqueue(first, 'first'), queue.enqueue(second, 'second')];
    await queue.flush();
    await Promise.all(writes);
    assert.equal(await readFile(first, 'utf8'), 'first');
    assert.equal(await readFile(second, 'utf8'), 'second');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('flush surfaces a queued write failure and shutdown rejects new writes', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'panvas-flush-fail-'));
  try {
    const queue = new WriteQueue();
    const target = path.join(root, 'asset.bin');
    await mkdir(`${target}.tmp-${process.pid}-1`);
    const failedWrite = queue.enqueue(target, 'data');
    const flushing = queue.flush();
    await assert.rejects(failedWrite);
    await assert.rejects(flushing);
    queue.beginShutdown();
    await assert.rejects(queue.enqueue(path.join(root, 'late'), 'late'), /shutting down/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('graceful shutdown flushes once and permits the recursive quit event', async () => {
  let beginCalls = 0;
  let flushCalls = 0;
  let quitCalls = 0;
  let prevented = 0;
  let releaseFlush!: () => void;
  const pending = new Promise<void>((resolve) => { releaseFlush = resolve; });
  const controller = new GracefulShutdownController({
    begin: () => { beginCalls += 1; },
    flush: () => { flushCalls += 1; return pending; },
    quit: () => { quitCalls += 1; },
    onFailure: () => assert.fail('flush should succeed'),
    timeoutMs: 1_000,
  });
  const event = { preventDefault: () => { prevented += 1; } };
  controller.handleBeforeQuit(event);
  controller.handleBeforeQuit(event);
  assert.equal(flushCalls, 1);
  releaseFlush();
  await controller.waitForCompletion();
  controller.handleBeforeQuit(event);
  assert.deepEqual({ beginCalls, flushCalls, quitCalls, prevented }, { beginCalls: 1, flushCalls: 1, quitCalls: 1, prevented: 2 });
});

test('graceful shutdown reports a flush failure and still reaches controlled quit', async () => {
  const failures: Error[] = [];
  let quitCalls = 0;
  const controller = new GracefulShutdownController({
    begin: () => undefined,
    flush: async () => { throw new Error('disk failure'); },
    quit: () => { quitCalls += 1; },
    onFailure: (error) => failures.push(error),
    timeoutMs: 1_000,
  });
  controller.handleBeforeQuit({ preventDefault: () => undefined });
  await controller.waitForCompletion();
  assert.equal(failures[0]?.message, 'disk failure');
  assert.equal(quitCalls, 1);
});
