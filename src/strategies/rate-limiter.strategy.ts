import { IStrategy } from '../interfaces/strategy.interface';
import { WaitPass } from '../interfaces/wait-pass.interface';

interface IRateLimterConfig {
  interval: number;
  occurrence: number;
}

/**
 * Restricts the executions count in the given interval to respect a rate limiter.
 */
export class RateLimiterStrategy implements IStrategy {
  protected threadActivity = new Map<number, number[]>();
  protected config: IRateLimterConfig = {
    interval: 1000,
    occurrence: 1,
  };

  constructor(config: Partial<IRateLimterConfig>) {
    this.config = { ...this.config, ...config };
  }

  async handleWaitPass(threadId: number, waitPass: WaitPass) {
    const now = Date.now();
    const activity = this.threadActivity.get(threadId);
    const inInterval = activity.filter(
      activityAt => now - activityAt < this.config.interval,
    );

    if (inInterval.length >= this.config.occurrence) {
      await new Promise(wait =>
        setTimeout(wait, this.config.interval - (now - inInterval.shift())),
      );
    }

    // Use the filtered activities to reduce the activity tracker.
    this.threadActivity.set(threadId, inInterval);

    waitPass();
  }

  threadFinished(threadId: number, activityAt: number) {
    if (!this.threadActivity.has(threadId)) {
      this.threadActivity.set(threadId, []);
    }

    this.threadActivity.get(threadId).push(activityAt);
  }
}
