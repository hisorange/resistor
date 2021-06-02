import { EVENTS } from '../src/events';
import { Resistor } from '../src/resistor';

/**
 * Test virtual threading feature
 */
jest.setTimeout(100);

describe('Single Threaded Flush Handling', () => {
  test('Flush buffer when maximum size is reached', async () => {
    const worker = jest.fn();
    const instance = new Resistor<number>(async () => worker(), {
      threads: 1,
      buffer: {
        size: 2,
      },
      autoFlush: false,
    });

    for (let n = 0; n < 6; n++) {
      await instance.push(n);
    }

    expect(worker).toHaveBeenCalledTimes(3);
    expect(instance.analytics.thread.opened).toBe(3);
    expect(instance.analytics.thread.active).toBe(0);
    expect(instance.analytics.thread.maximum).toBe(1);
    instance.deregister();
  });
});

describe('Multi Threaded Flush Handling', () => {
  test('Flush on 3 thread parallel', async () => {
    let recordsHandled = 0;
    const instance = new Resistor<number>(
      async () => {
        recordsHandled++;

        await new Promise(ok => setTimeout(ok, 5));
      },
      {
        threads: 3,
        buffer: {
          size: 3,
        },
        autoFlush: false,
      },
    );

    const flushExecuted = jest.fn().mockName('flushExecuted');
    const threadOpened = jest.fn().mockName('threadOpened');
    const threadClosed = jest.fn().mockName('threadClosed');

    instance.on(EVENTS.FLUSH_EXECUTED, flushExecuted);
    instance.on(EVENTS.THREAD_OPENED, threadOpened);
    instance.on(EVENTS.THREAD_CLOSED, threadClosed);

    for (let n = 0; n < 9; n++) {
      instance.push(n);
    }

    let threadClosedCnt = 0;

    // Wait until the threads close, we run a small process time on each thread.
    await new Promise<void>(ok => {
      instance.on(EVENTS.THREAD_CLOSED, () => {
        threadClosedCnt++;

        if (threadClosedCnt === 3) {
          ok();
        }
      });
    });

    expect(flushExecuted).toHaveBeenCalledTimes(3);
    expect(threadOpened).toHaveBeenCalledTimes(3);
    expect(threadClosed).toHaveBeenCalledTimes(3);

    expect(instance.analytics.thread.active).toBe(0);
    expect(instance.analytics.thread.opened).toBe(3);
    expect(instance.analytics.thread.closed).toBe(3);
    expect(instance.analytics.queue.waiting).toBe(0);

    expect(instance.analytics.record.received).toBe(9);
    expect(recordsHandled).toBe(3);

    instance.deregister();
  });

  test.concurrent.each([
    // Thread 1
    [1, 2],
    [1, 3],
    [1, 4],
    // Thread 2
    [2, 2],
    [2, 3],
    [2, 4],
    // Thread 4
    [4, 2],
    [4, 3],
    [4, 4],
    // Thread 8
    [8, 2],
    [8, 3],
    [8, 4],
  ])(
    'Flush on [%i] thread parallel with record [%i] per thread',
    async (threads, record) => {
      const sent = threads * record;
      let arrived = 0;
      const instance = new Resistor(
        async (records: number[]) => {
          arrived += records.length;
        },
        {
          threads,
          autoFlush: false,
          retrier: false,
          buffer: {
            size: 1,
          },
        },
      );

      for (let i = 0; i < sent; i++) {
        instance.push(i);
      }

      await instance.deregister();

      expect(arrived).toBe(sent);
      expect(instance.analytics.queue.waiting).toBe(0);
      expect(instance.analytics.thread.maximum).toBeLessThanOrEqual(threads);
    },
  );
});
