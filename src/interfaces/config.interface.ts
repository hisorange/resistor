import { IStrategy } from './strategy.interface';

export interface IResistorConfig {
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

  buffer: {
    /**
     * Buffer's maximum size when scheduled for flushing.
     */
    size: number;
  };

  limiter: {
    /**
     * Level where the strategy applied, on global level the given restrictions applied to every thread.
     * On thread level the restrictions applied to each thread individually.
     */
    level: 'global' | 'thread';

    /**
     * Configured limiting strategy handler.
     */
    strategy: IStrategy;
  };

  /**
   * Retries the handler if the handler throws an unhandled promise rejection.
   */
  retrier:
    | {
        times: number;
      }
    | false;
}
