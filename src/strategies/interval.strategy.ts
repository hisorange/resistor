import { IStrategy } from '../interfaces/strategy.interface';
import { WaitPass } from '../interfaces/wait-pass.interface';

interface IIntervalConfig {
  interval: number;
}

/**
 * Respecting the minimum delay between executions.
 */
export class IntervalStrategy implements IStrategy {
  protected monitor = new Map<number, number>();
  protected config: IIntervalConfig = {
    interval: 1000,
  };

  constructor(config: Partial<IIntervalConfig>) {
    this.config = { ...this.config, ...config };
  }

  async handleWaitPass(threadId: number, waitPass: WaitPass) {
    // Retrive the last finish epoch, so we can calculate the wait time until the next invokation.
    const lastFinishedAt = this.monitor.get(threadId) ?? 0;

    // Wait the minimum delay between execution
    const delay = Math.max(
      0,
      this.config.interval - (Date.now() - lastFinishedAt),
    );

    // Respect the minimum wait between the calls in single thread mode.
    if (delay > 0) {
      await new Promise(delayPass => setTimeout(delayPass, delay));
    }

    waitPass();
  }

  threadFinished(threadId: number, finishedAt: number) {
    this.monitor.set(threadId, finishedAt);
  }
}
