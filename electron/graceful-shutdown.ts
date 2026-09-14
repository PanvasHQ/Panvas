export interface BeforeQuitEventLike {
  preventDefault(): void;
}

export interface GracefulShutdownOptions {
  begin(): void;
  flush(): Promise<void>;
  quit(): void;
  onFailure(error: Error): void;
  timeoutMs: number;
}

export class GracefulShutdownController {
  private state: 'idle' | 'flushing' | 'ready' = 'idle';
  private completion: Promise<void> = Promise.resolve();
  private readonly options: GracefulShutdownOptions;

  constructor(options: GracefulShutdownOptions) {
    this.options = options;
  }

  handleBeforeQuit(event: BeforeQuitEventLike): void {
    if (this.state === 'ready') return;
    event.preventDefault();
    if (this.state === 'flushing') return;

    this.state = 'flushing';
    this.options.begin();
    this.completion = this.flushWithTimeout()
      .catch((error: unknown) => {
        this.options.onFailure(error instanceof Error ? error : new Error('Pending writes failed to flush.'));
      })
      .finally(() => {
        this.state = 'ready';
        this.options.quit();
      });
  }

  waitForCompletion(): Promise<void> {
    return this.completion;
  }

  private async flushWithTimeout(): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        this.options.flush(),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => reject(new Error('Timed out while flushing pending writes.')), this.options.timeoutMs);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
