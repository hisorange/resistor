import { EVENTS, IWorker, Resistor } from '../src';

/**
 * Tests for the event emitter feature.
 */
jest.setTimeout(100);
jest.mock('events');

const createTestInstance = (worker?: IWorker<any>) => {
  return new Resistor(worker ?? (async () => {}), {
    threads: 1,
    buffer: {
      size: 1,
    },
    autoFlush: false,
  });
};

describe('Event Emitter', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test(`should emit [${EVENTS.FLUSH_INVOKED}] event`, async () => {
    const instance = createTestInstance();
    const emitter = instance['emitter'];

    await instance.flush();
    expect(emitter.emit).toBeCalledWith(EVENTS.FLUSH_INVOKED, 1);

    await instance.flush();
    expect(emitter.emit).toBeCalledWith(EVENTS.FLUSH_INVOKED, 2);

    await instance.deregister();
  });

  test(`should emit [${EVENTS.FLUSH_SCHEDULED}] event`, async () => {
    const instance = createTestInstance();
    const emitter = instance['emitter'];

    await instance.push(1);
    expect(emitter.emit).toBeCalledWith(EVENTS.FLUSH_SCHEDULED, 1);

    await instance.push(1);
    expect(emitter.emit).toBeCalledWith(EVENTS.FLUSH_SCHEDULED, 2);

    await instance.deregister();
  });

  test(`should emit [${EVENTS.FLUSH_EXECUTED}] event`, async () => {
    const instance = createTestInstance();
    const emitter = instance['emitter'];

    await instance.push(1);
    expect(emitter.emit).toBeCalledWith(EVENTS.FLUSH_EXECUTED, 1);

    await instance.push(1);
    expect(emitter.emit).toBeCalledWith(EVENTS.FLUSH_EXECUTED, 2);

    instance.deregister();
  });

  test(`should emit [${EVENTS.THREAD_OPENED}] event`, async () => {
    const instance = createTestInstance();
    const emitter = instance['emitter'];

    await instance.push(1);
    expect(emitter.emit).toBeCalledWith(EVENTS.THREAD_OPENED, 1);

    await instance.push(1);
    expect(emitter.emit).toBeCalledWith(EVENTS.THREAD_OPENED, 2);

    instance.deregister();
  });

  test(`should emit [${EVENTS.THREAD_CLOSED}] event`, async () => {
    const instance = createTestInstance();
    const emitter = instance['emitter'];

    await instance.push(1);
    expect(emitter.emit).toBeCalledWith(EVENTS.THREAD_CLOSED, 1);

    await instance.push(1);
    expect(emitter.emit).toBeCalledWith(EVENTS.THREAD_CLOSED, 2);

    instance.deregister();
  });

  test(`should emit [${EVENTS.QUEUE_EMPTY}] event`, async () => {
    const instance = createTestInstance();
    const emitter = instance['emitter'];

    await Promise.all([instance.push(1), instance.push(2)]);
    expect(emitter.emit).toBeCalledWith(EVENTS.QUEUE_EMPTY);

    await instance.deregister();
  });

  test.concurrent.each([1, 2, 3, 10])(
    `should emit [${EVENTS.WORKER_REJECTED}] event with thread count [%i]`,
    async (threadCount: number) => {
      const rejection = new Error('Jest');
      const instance = new Resistor(() => Promise.reject(rejection), {
        threads: threadCount,
        buffer: {
          size: 1,
        },
        autoFlush: false,
      });
      const emitter = instance['emitter'];

      await instance.push(1);
      await instance.flush({ waitForWorker: true });
      await instance.deregister();

      expect(emitter.emit).toHaveBeenCalledWith(EVENTS.WORKER_REJECTED, {
        rejection,
        records: 1,
        errors: 1,
      });
    },
  );

  test.concurrent.each([1, 2, 3, 10])(
    `should emit [${EVENTS.WORKER_RETRYING}] event with thread count [%i]`,
    async (threadCount: number) => {
      const rejection = new Error('Jest');
      const createReturnValue = (retries: number) => ({
        rejection,
        retries,
        records: 1,
      });
      const instance = new Resistor(() => Promise.reject(rejection), {
        threads: threadCount,
        buffer: {
          size: 1,
        },
        autoFlush: false,
        retrier: {
          times: 4,
        },
      });
      const emitter = instance['emitter'];
      await instance.push(1);

      // Need to wait on low thread count because the scheduler can be executed on the next tick.
      await instance.flush({
        waitForWorker: true,
      });
      await instance.flush({
        waitForWorker: true,
      });

      expect(emitter.emit).toHaveBeenCalledWith(
        EVENTS.WORKER_RETRYING,
        createReturnValue(1),
      );
      expect(emitter.emit).toHaveBeenCalledWith(
        EVENTS.WORKER_RETRYING,
        createReturnValue(2),
      );
      expect(emitter.emit).toHaveBeenCalledWith(
        EVENTS.WORKER_RETRYING,
        createReturnValue(3),
      );
      expect(emitter.emit).toHaveBeenCalledWith(
        EVENTS.WORKER_RETRYING,
        createReturnValue(4),
      );
    },
  );

  test.concurrent.each([1, 2, 3, 8, 10])(
    `should emit [${EVENTS.EMPTY}] event with thread count [%i]`,
    async (threads: number) => {
      const sent = threads * 7;
      let handled = 0;
      const instance = new Resistor(
        async (records: number[]) => {
          handled += records.length;
        },
        {
          threads,
          buffer: {
            size: 2,
          },
          autoFlush: false,
        },
      );
      const emitter = instance['emitter'];

      for (let i = 0; i < sent; i++) {
        instance.push(i);
      }

      await instance.deregister();

      expect(instance.analytics.record.buffered).toBe(0);
      expect(instance.analytics.record.received).toBe(sent);
      expect(instance.analytics.queue.waiting).toBe(0);
      expect(instance.analytics.thread.active).toBe(0);
      expect(emitter.emit).toHaveBeenCalledWith(EVENTS.EMPTY);
    },
  );
});
