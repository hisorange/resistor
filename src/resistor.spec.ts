import { EVENTS } from './events';
import { Resistor } from './resistor';

describe('Auto flush', () => {
  it('Flush on timer without reaching the max size', done => {
    const handler = async (records: number[]) => {
      expect(records).toEqual(expect.arrayContaining([1, 2, 3]));

      instance.deregister();

      done();
    };

    const instance = new Resistor<number>(handler, {
      buffer: {
        size: 4,
      },
      autoFlush: {
        delay: 3,
      },
    });

    instance.push(1);
    instance.push(2);
    instance.push(3);
  });

  it('Flush on the leftover', done => {
    const handler = async (records: number[]) => {
      if (records.length === 2) {
        expect(records).toEqual(expect.arrayContaining([1, 2]));
      } else {
        expect(records).toEqual(expect.arrayContaining([3]));
        instance.deregister();
        done();
      }
    };

    const instance = new Resistor<number>(handler, {
      buffer: {
        size: 2,
      },
      autoFlush: {
        delay: 3,
      },
    });

    instance.push(1);
    instance.push(2);
    instance.push(3);
  });
});

describe('Single threaded flush handling', () => {
  it('Flush buffer when maximum size is reached', async () => {
    const handler = jest.fn();
    const instance = new Resistor<number>(async () => handler(), {
      threads: 1,
      buffer: {
        size: 2,
      },
      autoFlush: {
        enabled: false,
      },
    });

    for (let n = 0; n < 6; n++) {
      await instance.push(n);
    }

    expect(handler).toHaveBeenCalledTimes(3);
  });
});

describe('Multi threaded flush handling', () => {
  it('Flush on 3 thread parallel', async () => {
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
        autoFlush: {
          enabled: false,
        },
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
  });
});

describe('Flush error handler', () => {
  it('Dispatch the error caused by the handler', done => {
    const handler = async () => {
      throw new Error('ByHandler');
    };
    const instance = new Resistor<string>(handler, {
      buffer: {
        size: 1,
      },
      autoFlush: {
        enabled: false,
      },
    });

    instance.push('e');

    instance.on(EVENTS.FLUSH_ERROR, ({ error, count }) => {
      expect(count).toBe(1);
      expect(error.message).toBe('ByHandler');
      done();
    });
  });
});
