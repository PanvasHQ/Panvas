import { promises as fsPromises } from 'fs';

interface WriteTask {
  filePath: string;
  data: string;
  resolve: () => void;
  reject: (err: Error) => void;
}

class WriteQueue {
  private queue: WriteTask[] = [];
  private isWriting = false;

  async enqueue(filePath: string, data: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.queue.push({ filePath, data, resolve, reject });
      this.processNext();
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
          tasks.forEach(({ reject }) => reject(failure));
        }
      }
    } finally {
      this.isWriting = false;
      if (this.queue.length > 0) void this.processNext();
    }
  }

  private async atomicWrite(targetPath: string, data: string) {
    const tempPath = targetPath + '.tmp';
    await fsPromises.writeFile(tempPath, data, 'utf8');
    
    let retries = 5;
    let delay = 100;
    
    while (retries > 0) {
      try {
        await fsPromises.rename(tempPath, targetPath);
        return; // Success
      } catch (err: any) {
        if (err.code === 'EPERM' || err.code === 'EBUSY' || err.code === 'EACCES') {
          retries--;
          if (retries === 0) throw err;
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2; // Exponential backoff
        } else {
          throw err;
        }
      }
    }
  }
}

export const writeQueue = new WriteQueue();
