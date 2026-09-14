import { promises as fsPromises } from 'fs';

export type AtomicWriteData = string | Uint8Array;

interface WriteTask {
  filePath: string;
  data: AtomicWriteData;
  resolve: () => void;
  reject: (err: Error) => void;
}

interface FlushWaiter {
  resolve: () => void;
  reject: (err: Error) => void;
}

export class WriteQueue {
  private queue: WriteTask[] = [];
  private isWriting = false;
  private tempSequence = 0;
  private acceptingWrites = true;
  private lastFailure: Error | null = null;
  private flushWaiters: FlushWaiter[] = [];

  async enqueue(filePath: string, data: AtomicWriteData): Promise<void> {
    if (!this.acceptingWrites) throw new Error('Write queue is shutting down.');
    return new Promise((resolve, reject) => {
      this.queue.push({ filePath, data, resolve, reject });
      this.processNext();
    });
  }

  beginShutdown(): void {
    this.acceptingWrites = false;
  }

  async flush(): Promise<void> {
    if (!this.isWriting && this.queue.length === 0) {
      const failure = this.takeFailure();
      if (failure) throw failure;
      return;
    }
    return new Promise((resolve, reject) => {
      this.flushWaiters.push({ resolve, reject });
    });
  }

  private async processNext(): Promise<void> {
    if (this.isWriting || this.queue.length === 0) return;
    this.isWriting = true;
    try {
      // Coalesce writes to the same file while preserving each caller's result.
      const taskMap = new Map<string, WriteTask[]>();
      while (this.queue.length > 0) {
        const task = this.queue.shift()!;
        const tasks = taskMap.get(task.filePath) ?? [];
        tasks.push(task);
        taskMap.set(task.filePath, tasks);
      }

      for (const [filePath, tasks] of taskMap.entries()) {
        const latest = tasks[tasks.length - 1];
        try {
          await this.atomicWrite(filePath, latest.data);
          tasks.forEach(({ resolve }) => resolve());
        } catch (error) {
          const failure = error instanceof Error ? error : new Error('Atomic write failed.');
          this.lastFailure ??= failure;
          tasks.forEach(({ reject }) => reject(failure));
        }
      }
    } finally {
      this.isWriting = false;
      if (this.queue.length > 0) void this.processNext();
      else this.settleFlushWaiters();
    }
  }

  private takeFailure(): Error | null {
    const failure = this.lastFailure;
    this.lastFailure = null;
    return failure;
  }

  private settleFlushWaiters(): void {
    if (this.isWriting || this.queue.length > 0 || this.flushWaiters.length === 0) return;
    const waiters = this.flushWaiters.splice(0);
    const failure = this.takeFailure();
    for (const waiter of waiters) {
      if (failure) waiter.reject(failure);
      else waiter.resolve();
    }
  }

  // DATA SAFETY: Atomic file replacement invariant.
  // 1. Write payload to unique PID-sequenced temporary file.
  // 2. Call fsync() to guarantee hardware disk flush before rename.
  // 3. Rename over target path atomically to ensure the file is never truncated on crash.
  // 4. Retry boundedly on Windows EBUSY/EPERM lock collisions with exponential backoff & jitter.
  private async atomicWrite(targetPath: string, data: AtomicWriteData) {
    const tempPath = `${targetPath}.tmp-${process.pid}-${++this.tempSequence}`;
    let handle: Awaited<ReturnType<typeof fsPromises.open>> | null = null;
    try {
      handle = await fsPromises.open(tempPath, 'w');
      await handle.writeFile(data, typeof data === 'string' ? { encoding: 'utf8' } : undefined);
      await handle.sync();
      await handle.close();
      handle = null;

      // Cloud-sync/indexer processes commonly hold a just-written file for a
      // short period on Windows. Keep retries bounded while giving those
      // transient locks time to clear; permanent errors still reject and the
      // previous target remains untouched because the temp file is separate.
      let retries = 10;
      let delay = 50;
      while (retries > 0) {
        try {
          await fsPromises.rename(tempPath, targetPath);
          return;
        } catch (err: any) {
          if (err.code === 'EPERM' || err.code === 'EBUSY' || err.code === 'EACCES') {
            retries--;
            if (retries === 0) throw err;
            const jitter = Math.floor(Math.random() * 25);
            await new Promise(resolve => setTimeout(resolve, Math.min(1000, delay + jitter)));
            delay = Math.min(1000, delay * 2);
          } else {
            throw err;
          }
        }
      }
    } finally {
      await handle?.close().catch(() => undefined);
      await fsPromises.rm(tempPath, { force: true }).catch(() => undefined);
    }
  }
}

export const writeQueue = new WriteQueue();
