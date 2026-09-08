/** Serializes sync requests while coalescing every in-flight request into one rerun. */
export class SinglePendingRunner {
  private active: Promise<void> | null = null;
  private pending = false;

  get hasPending(): boolean { return this.pending; }

  request(run: () => Promise<void>): Promise<void> {
    if (this.active) {
      this.pending = true;
      return this.active;
    }
    this.active = (async () => {
      try {
        do {
          this.pending = false;
          await run();
        } while (this.pending);
      } finally {
        this.active = null;
      }
    })();
    return this.active;
  }
}
