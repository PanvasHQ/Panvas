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

  private async processNext() {
    if (this.isWriting || this.queue.length === 0) return;
    this.isWriting = true;
    
    // Coalesce writes to the same file: take the last one in the queue for each file
    const taskMap = new Map<string, WriteTask>();
    const callbacksToResolve: { resolve: () => void, reject: (e: Error) => void }[] = [];
    
    while (this.queue.length > 0) {
      const task = this.queue.shift()!;
      // Overwrite previous task for the same file
      taskMap.set(task.filePath, task);
      callbacksToResolve.push({ resolve: task.resolve, reject: task.reject });
    }
    
    for (const [filePath, task] of taskMap.entries()) {
      try {
        await this.atomicWrite(filePath, task.data);
      } catch (err) {
        console.error('Failed atomic write:', err);
      }
    }
    
    for (const cb of callbacksToResolve) {
      cb.resolve();
    }
    
    this.isWriting = false;
    if (this.queue.length > 0) {
      this.processNext();
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
