import { IStrategy } from './strategy.interface';

export interface IResistorConfig {
  /**
   * Maximum amount of virtual threads.
   */
  threads: number;

  autoFlush: {
    /**
     * Use this switch to disable the auto flush feature, you can call flush before your script shutsdown to
     * provide a similiar functionality.
     */
    enabled: boolean;

    /**
     * Interval delayed between auto flush calls.
     */
    delay: number;
  };

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
}
