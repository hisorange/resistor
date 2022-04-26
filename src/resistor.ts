import EventEmitter from 'events';
import merge from 'ts-deepmerge';
import { EVENTS } from './events';
import { IAnalytics } from './interfaces/analytics.interface';
import { IResistorConfig } from './interfaces/config.interface';
import { DeepPartial } from './interfaces/deep-partial.type';
import { EventListener } from './interfaces/event-listener.type';
import { IFlushConfig } from './interfaces/flush-config.interface';
import { WaitPass } from './interfaces/wait-pass.interface';
import {
  IBufferedWorker,
  ISingleRecordWorker,
  IWorker,
} from './interfaces/worker.interface';
import { UnboundStrategy } from './strategies/unbound.strategy';

export class Resistor<I> implements Pick<EventEmitter, 'on' | 'once' | 'off'> {
  /**
   * Temporary buffer to store the records until the worker flushes them.
   */
  protected buffer: I[] = [];

  /**
   * Continouosly delayed timer to ensure the flush is called reguraly even if
   * the buffer would not reach it's maximum size.
   */
  protected flushTimer: NodeJS.Timer | undefined;

  /**
   * Stores the active flush workers, this is how the script tracks the active "threads".
   */
  protected vThreads: Promise<void>[] = [];

  /**
   * When the maximum thread reached, the script will enqueue the flush workers in a FIFO logic,
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
      delay: 1000,
    },

    limiter: {
      level: 'global',
      strategy: new UnboundStrategy(),
    },

    retrier: false,
  };

  /**
   * Usage analytics, designed to be used with healthchecks.
   */
  protected _analytics: IAnalytics = {
    worker: {
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
      maximum: 0,
    },
    queue: {
      waiting: 0,
      maximum: 0,
    },
    record: {
      received: 0,
      buffered: 0,
    },
  };

  /**
   * NodeJS event emitter.
   */
  protected emitter: EventEmitter;

  /**
   * Store the reference to the worker function.
   */
  protected worker: IWorker<I>;

  /**
   * Initialize a configured resistor.
   */
  constructor(worker: IWorker<I>, config?: DeepPartial<IResistorConfig>) {
    // Merge the config overides to the base config.
    if (config) {
      this.config = merge(this.config, config);
    }

    // Help the type system.
    if (this.config.buffer.size === 1) {
      this.worker = worker as ISingleRecordWorker<I>;
    } else {
      this.worker = worker as IBufferedWorker<I>;
    }

    // Start the auto flush timer if it's configured.
    this.register();

    // Create an event emitter.
    this.emitter = new EventEmitter();
  }

  /**
   * Register an event listener for every occasion when the event emitted.
   */
  on(event: EVENTS, listener: EventListener): EventEmitter {
    return this.emitter.on(event, listener);
  }

  /**
   * Register an event listener for one event emitting.
   */
  once(event: EVENTS, listener: EventListener): EventEmitter {
    return this.emitter.once(event, listener);
  }

  /**
   * Deregister the given event listener.
   */
  off(event: EVENTS, listener: EventListener): EventEmitter {
    return this.emitter.off(event, listener);
  }

  /**
   * Register an auto flush timeout in case the buffer is not loaded to the full
   * and we need to trigger an flush by timer.
   *
   * This is always being pushed out when the buffer reaches the maximum size.
   */
  protected register() {
    if (this.config.autoFlush) {
      this.flushTimer = setTimeout(
        () => this.flush(),
        this.config.autoFlush.delay,
      );
    }
  }

  /**
   * Call this before shutdown to empty the last buffer and remove the timer.
   * Also useful to await this because only resolves when the buffer, queue, and threads are empty.
   *
   * @example process.on('SIGTERM', resistor.deregister.bind(resistor));
   * @example process.on('SIGKILL', resistor.deregister.bind(resistor));
   */
  async deregister() {
    // Inactivate the timer registration.
    this.config.autoFlush = false;

    // Flush the last buffer.
    if (this.buffer.length > 0) {
      await this.flush({
        waitForWorker: true,
      });
    }

    // Wait until the jobs are finished
    while (this.waitQueue.length) {
      await Promise.all(this.waitQueue);
    }

    // Queue maybe empty but the vThreads could be loaded.
    if (this.vThreads.length) {
      await Promise.all(this.vThreads);
    }

    // Remove the last auto timer.
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
    }

    // Remove hanging listeners.
    this.emitter.removeAllListeners();
  }

  /**
   * Initiate a flush, this will schedule the current buffer to a virtual thread.
   *
   * Important! By default the flush will not wait for the worker to execute so the caller
   * can push the records until the active threads are populated without waiting.
   *
   * But when the deregister called the script will wait for the last flush to be handled.
   */
  async flush(config: IFlushConfig = { waitForWorker: false }) {
    this.emitter.emit(EVENTS.FLUSH_INVOKED, ++this._analytics.worker.invoked);

    // Release the auto flush until the buffer is freed.
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
    }

    if (this.buffer.length > 0) {
      this.emitter.emit(
        EVENTS.FLUSH_SCHEDULED,
        ++this._analytics.worker.scheduled,
      );

      let records: I | I[];

      // We cut the maximum record and leave an empty array behind,
      // this is needed in case an async .push has been called while an other call started the flush.
      if (this.config.buffer.size === 1) {
        records = this.buffer.pop() as I;
        this._analytics.record.buffered--;
      } else {
        records = this.buffer.splice(0, this.config.buffer.size) as I[];
        this._analytics.record.buffered -= records.length;
      }

      // Retry counter.
      let retries = 0;

      const job = (threadId: number) =>
        this.worker(records as I & I[], threadId).catch(async rejection => {
          this.emitter.emit(EVENTS.WORKER_REJECTED, {
            rejection,
            records,
            errors: ++this._analytics.worker.errors,
          });

          // Retrying is enabled
          if (this.config.retrier) {
            // We are below the maximum tries.
            if (++retries <= this.config.retrier.times) {
              this.emitter.emit(EVENTS.WORKER_RETRYING, {
                rejection,
                records,
                retries,
              });

              await job(threadId);
            }
          }
        });

      // Schedule the worker for execution, the strategy will handle the timings.
      await this.schedule(job, config.waitForWorker);
    }

    // Always push the auto flush even if the next flush will do the same.
    this.register();
  }

  /**
   * Handles the actual thread scheduling, the flush simply just packages an execution
   * and the scheduler is responsible to manage the queue and the threads.
   */
  protected async schedule(
    job: (threadId: number) => Promise<void>,
    waitForWorker: boolean,
  ): Promise<void> {
    // Limit the maximum "virtual threads" to the configured threshold.
    if (this._analytics.thread.active >= this.config.threads) {
      this._analytics.queue.maximum = Math.max(
        this._analytics.queue.maximum,
        ++this._analytics.queue.waiting,
      );

      // Wait until a thread finishes and allows the execution of this flush.
      await new Promise(waitPass => this.waitQueue.push(waitPass));
    }

    // Track maximum thread count.
    this._analytics.thread.maximum = Math.max(
      ++this._analytics.thread.active,
      this._analytics.thread.maximum,
    );

    this.emitter.emit(EVENTS.THREAD_OPENED, ++this._analytics.thread.opened);

    const startedAt = Date.now();

    // Push the execution to a free thread.
    const threadId = this.vThreads.push(job(this.vThreads.length)) - 1;

    // Hook to handle thread removal.
    const worker = this.vThreads[threadId].then(() => {
      const finishedAt = Date.now();

      // Track the execution time.
      this._analytics.worker.processTime = finishedAt - startedAt;
      this.emitter.emit(
        EVENTS.FLUSH_EXECUTED,
        ++this._analytics.worker.executed,
      );

      // Remove the process after finish.
      this.vThreads.splice(threadId, 1);

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
        this._analytics.queue.waiting--;

        if (typeof waitPass === 'function') {
          this.config.limiter.strategy.handleWaitPass(vThreadId, waitPass);
        }

        // Indicate that the queue has been used and now it's empty again.
        if (this.waitQueue.length === 0) {
          this.emitter.emit(EVENTS.QUEUE_EMPTY);
        }
      }

      // Resistor is totaly empty.
      if (
        !this.buffer.length &&
        !this._analytics.thread.active &&
        !this._analytics.queue.waiting
      ) {
        this.emitter.emit(EVENTS.EMPTY);
      }
    });

    // The flush wants to wait for the worker as well.
    if (waitForWorker) {
      await worker;
    }
  }

  /**
   * Push a record to the buffer, returns a promise which should be awaited so
   * the caller can be slowed down when the threads are overloaded.
   */
  async push(record: I): Promise<void> {
    this._analytics.record.received++;
    this._analytics.record.buffered++;
    this.buffer.push(record);

    if (this.buffer.length >= this.config.buffer.size) {
      await this.flush();
    }
  }

  /**
   * Reads the current analytics.
   */
  get analytics(): IAnalytics {
    return this._analytics;
  }
}
