import EventEmitter from 'events';
import merge from 'ts-deepmerge';
import { EVENTS } from './events';
import { IResistorConfig } from './interfaces/config.interface';
import { Handler } from './interfaces/handler.interface';
import { WaitPass } from './interfaces/wait-pass.interface';
import { UnboundStrategy } from './strategies/unbound.strategy';

type DeepPartial<T> = {
  [propertyKey in keyof T]?: DeepPartial<T[propertyKey]>;
};

type EventListener = (...args: any[]) => void;

export class Resistor<I> implements Pick<EventEmitter, 'on' | 'once' | 'off'> {
  /**
   * Temporary buffer to store the records until the handler flushes them.
   */
  protected buffer: I[] = [];

  /**
   * Continouosly delayed timer to ensure the flush is called reguraly even if
   * the buffer would not reach it's maximum size.
   */
  protected autoFlushTimer: NodeJS.Timer | undefined;

  /**
   * Stores the active flush handlers, this is how the script tracks the active "threads".
   */
  protected virtualThreads: Promise<void>[] = [];

  /**
   * When the maximum thread reached, the script will enqueue the flush handlers in a FIFO logic,
   * after a thread finished, it will shift the first waiting execution and allows its execution.
   */
  protected waitQueue: WaitPass[] = [];

  /**
   * Stores the manageging configurations.
   */
  protected config: IResistorConfig = {
    threads: 10,

    buffer: {
      size: 100,
    },

    autoFlush: {
      enabled: true,
      delay: 1000,
    },

    limiter: {
      level: 'global',
      strategy: new UnboundStrategy(),
    },
  };

  /**
   * Usage analytics, designed to be used with healthchecks.
   */
  protected _analytics = {
    flush: {
      invoked: 0,
      scheduled: 0,
      executed: 0,
      errors: 0,
      processTime: 0,
    },
    thread: {
      active: 0,
      opened: 0,
      closed: 0,
    },
    queue: {
      waiting: 0,
    },
    record: {
      received: 0,
    },
  };

  /**
   * NodeJS event emitter.
   */
  protected emitter: EventEmitter;

  constructor(
    protected handler: Handler<I>,
    config?: DeepPartial<IResistorConfig>,
  ) {
    // Merge the config overides to the base config.
    if (config) {
      this.config = merge(this.config, config);
    }

    this.register();

    this.emitter = new EventEmitter();
  }

  on(event: EVENTS, listener: EventListener) {
    return this.emitter.on(event, listener);
  }

  once(event: EVENTS, listener: EventListener) {
    return this.emitter.once(event, listener);
  }

  off(event: EVENTS, listener: EventListener) {
    return this.emitter.off(event, listener);
  }

  /**
   * Register an auto flush timeout in case the buffer is not loaded to the full
   * and we need to trigger an flush by timer.
   *
   * This is always being pushed out when the buffer reaches the maximum size.
   */
  protected register() {
    if (this.config.autoFlush.enabled) {
      this.autoFlushTimer = setTimeout(
        () => this.flush(),
        this.config.autoFlush.delay,
      );
    }
  }

  /**
   * Call this before shutdown to empty the last buffer and remove the timer.
   *
   * @example process.on('SIGTERM', resistor.deregister.bind(resistor));
   * @example process.on('SIGKILL', resistor.deregister.bind(resistor));
   */
  async deregister() {
    // Inactivate the timer registration.
    this.config.autoFlush.enabled = false;

    // Flush the last buffer.
    if (this.buffer.length > 0) {
      await this.flush({
        waitForHandler: true,
      });
    }

    if (this.autoFlushTimer) {
      clearTimeout(this.autoFlushTimer);
    }

    // Remove hanging listeners.
    this.emitter.removeAllListeners();
  }

  /**
   * Initiate a flush, this will schedule the current buffer to a virtual thread.
   *
   * Important! By default the flush will not wait for the handler to execute so the caller
   * can push the records until the active threads are populated without waiting.
   *
   * But when the deregister called the script will wait for the last flush to be handled.
   */
  async flush(
    { waitForHandler }: { waitForHandler: boolean } = { waitForHandler: false },
  ) {
    this.emitter.emit(EVENTS.FLUSH_INVOKED, ++this._analytics.flush.invoked);

    // Release the auto flush until the buffer is freed.
    if (this.autoFlushTimer) {
      clearTimeout(this.autoFlushTimer);
    }

    if (this.buffer.length > 0) {
      this.emitter.emit(
        EVENTS.FLUSH_SCHEDULED,
        ++this._analytics.flush.scheduled,
      );

      // We cut the maximum record and leave an empty array behind,
      // this is needed in case an async .push has been called while an other call started the flush.
      const records = this.buffer.splice(0, this.config.buffer.size);
      const job = () =>
        this.handler(records).catch(error => {
          this.emitter.emit(EVENTS.FLUSH_ERROR, {
            error,
            count: ++this._analytics.flush.errors,
          });
        });

      // Schedule the handler for execution, the strategy will handle the timings.
      await this.schedule(job, waitForHandler);
    }

    // Always push the auto flush even if the next flush will do the same.
    this.register();
  }

  /**
   * Handles the actual thread scheduling, the flush simply just packages an execution
   * and the scheduler is responsible to manage the queue and the threads.
   */
  protected async schedule(
    job: () => Promise<void>,
    waitForHandler: boolean,
  ): Promise<void> {
    // Limit the maximum "virtual threads" to the configured threshold.
    if (this.virtualThreads.length >= this.config.threads) {
      this._analytics.queue.waiting++;

      // Wait until a thread finishes and allows the execution of this flush.
      await new Promise(waitPass => this.waitQueue.push(waitPass));

      this._analytics.queue.waiting--;
    }

    // Count thread as active.
    this._analytics.thread.active++;
    this.emitter.emit(EVENTS.THREAD_OPENED, ++this._analytics.thread.opened);

    const startedAt = Date.now();

    // Push the execution to a free thread.
    const threadId = this.virtualThreads.push(job()) - 1;

    // Hook to handle thread removal.
    const handler = this.virtualThreads[threadId].then(() => {
      const finishedAt = Date.now();

      // Track the execution time.
      this._analytics.flush.processTime = finishedAt - startedAt;
      this.emitter.emit(
        EVENTS.FLUSH_EXECUTED,
        ++this._analytics.flush.executed,
      );

      // Remove the process after finish.
      this.virtualThreads.splice(threadId, 1);

      // Mark thread as inactive.
      this._analytics.thread.active--;
      this.emitter.emit(EVENTS.THREAD_CLOSED, ++this._analytics.thread.closed);

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

        // Indicate that the queue has been used and now it's empty again.
        if (this.waitQueue.length === 0) {
          this.emitter.emit(EVENTS.QUEUE_EMPTY);
        }
      }
    });

    // The flush wants to wait for the handler as well.
    if (waitForHandler) {
      await handler;
    }
  }

  /**
   * Push a record to the buffer, returns a promise which should be awaited so
   * the caller can be slowed down when the threads are overloaded.
   */
  async push(record: I): Promise<void> {
    this._analytics.record.received++;
    this.buffer.push(record);

    if (this.buffer.length >= this.config.buffer.size) {
      await this.flush();
    }
  }

  get analytics() {
    return this._analytics;
  }
}
