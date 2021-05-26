import merge from 'ts-deepmerge';
import { IResistorConfig } from './interfaces/config.interface';
import { Handler } from './interfaces/handler.interface';
import { WaitPass } from './interfaces/wait-pass.interface';
import { UnboundStrategy } from './strategies/unbound.strategy';

export class Resistor<I> {
  protected recordBuffer: I[] = [];
  protected autoFlushTimer: NodeJS.Timer | undefined;
  protected virtualThreads: Promise<void>[] = [];
  protected waitQueue: WaitPass[] = [];

  protected config: IResistorConfig = {
    threads: 10,
    buffer: {
      size: 100,
    },
    autoFlush: {
      delay: 1000,
    },

    limiter: {
      level: 'global',
      strategy: new UnboundStrategy(),
    },
  };

  protected analytics = {
    flushCount: 0,
    executionTotalTime: 0,
    recordReceived: 0,
  };

  constructor(
    protected handler: Handler<I>,
    config?: Partial<IResistorConfig>,
  ) {
    // Merge the config overides to the base config.
    if (config) {
      this.config = merge(this.config, config);
    }

    this.register();
  }

  /**
   * Register an auto flush timeout in case the buffer is not loaded to the full
   * and we need to trigger an flush by timer.
   *
   * This is always being pushed out when the buffer reaches the maximum size.
   */
  protected register() {
    this.autoFlushTimer = setTimeout(
      this.flush.bind(this),
      this.config.autoFlush.delay,
    );
  }

  /**
   * Call this before shutdown to empty the last buffer and remove the timer.
   *
   * @example process.on('SIGTERM', resistor.deregister.bind(resistor));
   */
  async deregister() {
    if (this.recordBuffer.length > 0) {
      await this.flush();
    }

    if (this.autoFlushTimer) {
      clearTimeout(this.autoFlushTimer);
    }
  }

  /**
   * Initiate a flush, this will schedule the current buffer to a virtual thread
   * and waits until executed.
   */
  async flush() {
    this.analytics.flushCount++;

    // Release the auto flush until the buffer is freed.
    if (this.autoFlushTimer) {
      clearTimeout(this.autoFlushTimer);
    }

    if (this.recordBuffer.length > 0) {
      // We cut the maximum record and leave an empty array behind,
      // this is needed in case an async .push has been called while an other call started the flush.
      const records = this.recordBuffer.splice(0, this.config.buffer.size);

      // Schedule the handler for execution, the strategy will handle the timings.
      await this.schedule(() =>
        this.handler(records).catch(this.onError.bind(this)),
      );
    }

    // Always push the auto flush even if the next flush will do the same.
    this.register();
  }

  protected async schedule(execution: () => Promise<void>) {
    // Limit the maximum "virtual threads" to the configured threshold.
    if (this.virtualThreads.length >= this.config.threads) {
      await new Promise(waitPass => this.waitQueue.push(waitPass));
    }

    const startedAt = Date.now();

    // Push the execution to a free thread.
    const threadId = this.virtualThreads.push(execution()) - 1;

    // Wait until it finishes, the error is handled by the process.
    await this.virtualThreads[threadId];

    const finishedAt = Date.now();

    // Track the execution time.
    this.analytics.executionTotalTime = finishedAt - startedAt;

    // Remove the process after finish.
    this.virtualThreads.splice(threadId, 1);

    // When we apply the limiter globaly we use the 0 thread for faking a single thread.
    const vThreadId = this.config.limiter.level === 'global' ? 0 : threadId;

    // Let the strategy know, the thread just handled an execution.
    this.config.limiter.strategy.threadFinished(vThreadId, finishedAt);

    // Check for waiting processes.
    if (this.waitQueue.length > 0) {
      // Get the first waiting pass from the queue.
      const waitPass = this.waitQueue.shift();

      if (typeof waitPass === 'function') {
        this.config.limiter.strategy.handleWaitPass(vThreadId, waitPass);
      }
    }
  }

  onError(error: Error) {
    console.error(error);
  }

  async push(record: I): Promise<void> {
    this.analytics.recordReceived++;
    this.recordBuffer.push(record);

    if (this.recordBuffer.length >= this.config.buffer.size) {
      await this.flush();
    }
  }
}
