import { IStrategy } from './strategy.interface';

interface SharedConfig {
  /**
   * Maximum amount of virtual threads.
   */
  threads: number;

  /**
   * Empties the buffer even if the maximum is not reached.
   */
  autoFlush:
    | {
        /**
         * Interval delayed between auto flush calls.
         */
        delay: number;
      }
    | false;

  limiter: {
    /**
     * Level where the strategy applied, on global level the given restrictions applied to every thread.
     * On thread level the restrictions applied to each thread individually.
     */
    level: 'global' | 'thread';

    /**
     * Configured limiting strategy worker.
     */
    strategy: IStrategy;
  };

  /**
   * Retries the worker if the worker throws an unhandled promise rejection.
   */
  retrier:
    | {
        times: number;
      }
    | false;
}

export interface IUnbufferedConfig extends SharedConfig {
  buffer: false;
  autoFlush: false;
}

export interface IBufferedConfig extends SharedConfig {
  buffer: {
    size: number;
  };
}
