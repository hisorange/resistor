import { EVENTS, IHandler, Resistor } from '../src';

jest.setTimeout(100);
jest.mock('events');

const createTestInstance = (handler?: IHandler<any>) => {
  return new Resistor(handler ?? (async () => {}), {
    threads: 1,
    buffer: {
      size: 1,
    },
    autoFlush: false,
  });
};

describe('Event handler', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should register the event listener', () => {
    const instance = createTestInstance();
    const emitter = instance['emitter'];
    const listener = () => {};

    instance.on(EVENTS.THREAD_OPENED, listener);

    expect(emitter.on).toBeCalledTimes(1);
    expect(emitter.on).toBeCalledWith(EVENTS.THREAD_OPENED, listener);

    instance.deregister();
  });

  it('should register the event listener once', () => {
    const instance = createTestInstance();
    const emitter = instance['emitter'];
    const listener = () => {};

    instance.once(EVENTS.THREAD_OPENED, listener);

    expect(emitter.once).toBeCalledTimes(1);
    expect(emitter.once).toBeCalledWith(EVENTS.THREAD_OPENED, listener);

    instance.deregister();
  });

  it('should deregister the event listener', () => {
    const instance = createTestInstance();
    const emitter = instance['emitter'];
    const listener = () => {};

    instance.on(EVENTS.THREAD_OPENED, listener);
    instance.off(EVENTS.THREAD_OPENED, listener);

    expect(emitter.off).toBeCalledTimes(1);
    expect(emitter.off).toBeCalledWith(EVENTS.THREAD_OPENED, listener);

    instance.deregister();
  });
});

describe('Event emitting', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it(`should dispatch [${EVENTS.FLUSH_INVOKED}] event`, async () => {
    const instance = createTestInstance();
    const emitter = instance['emitter'];

    await instance.flush();
    expect(emitter.emit).toBeCalledWith(EVENTS.FLUSH_INVOKED, 1);

    await instance.flush();
    expect(emitter.emit).toBeCalledWith(EVENTS.FLUSH_INVOKED, 2);

    instance.deregister();
  });

  it(`should dispatch [${EVENTS.FLUSH_SCHEDULED}] event`, async () => {
    const instance = createTestInstance();
    const emitter = instance['emitter'];

    await instance.push(1);
    expect(emitter.emit).toBeCalledWith(EVENTS.FLUSH_SCHEDULED, 1);

    await instance.push(1);
    expect(emitter.emit).toBeCalledWith(EVENTS.FLUSH_SCHEDULED, 2);

    instance.deregister();
  });

  it(`should dispatch [${EVENTS.FLUSH_EXECUTED}] event`, async () => {
    const instance = createTestInstance();
    const emitter = instance['emitter'];

    await instance.push(1);
    expect(emitter.emit).toBeCalledWith(EVENTS.FLUSH_EXECUTED, 1);

    await instance.push(1);
    expect(emitter.emit).toBeCalledWith(EVENTS.FLUSH_EXECUTED, 2);

    instance.deregister();
  });

  it(`should dispatch [${EVENTS.THREAD_OPENED}] event`, async () => {
    const instance = createTestInstance();
    const emitter = instance['emitter'];

    await instance.push(1);
    expect(emitter.emit).toBeCalledWith(EVENTS.THREAD_OPENED, 1);

    await instance.push(1);
    expect(emitter.emit).toBeCalledWith(EVENTS.THREAD_OPENED, 2);

    instance.deregister();
  });

  it(`should dispatch [${EVENTS.THREAD_CLOSED}] event`, async () => {
    const instance = createTestInstance();
    const emitter = instance['emitter'];

    await instance.push(1);
    expect(emitter.emit).toBeCalledWith(EVENTS.THREAD_CLOSED, 1);

    await instance.push(1);
    expect(emitter.emit).toBeCalledWith(EVENTS.THREAD_CLOSED, 2);

    instance.deregister();
  });

  it(`should dispatch [${EVENTS.QUEUE_EMPTY}] event`, async () => {
    const instance = createTestInstance();
    const emitter = instance['emitter'];

    instance.push(1);
    await instance.push(2);
    expect(emitter.emit).toBeCalledWith(EVENTS.QUEUE_EMPTY);

    instance.deregister();
  });

  test.concurrent.each([1, 2, 3, 10])(
    `should dispatch [${EVENTS.FLUSH_REJECTED}] event with thread count [%i]`,
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
      await instance.flush({ waitForHandler: true });
      await instance.deregister();

      expect(emitter.emit).toHaveBeenCalledWith(EVENTS.FLUSH_REJECTED, {
        rejection,
        records: [1],
        errors: 1,
      });
    },
  );

  test.concurrent.each([1, 2, 3, 10])(
    `should dispatch [${EVENTS.FLUSH_RETRYING}] event with thread count [%i]`,
    async (threadCount: number) => {
      const rejection = new Error('Jest');
      const createReturnValue = (retries: number) => ({
        rejection,
        retries,
        records: [1],
      });
      const instance = new Resistor(() => Promise.reject(rejection), {
        threads: threadCount,
        buffer: {
          size: 1,
        },
        autoFlush: false,
        retrier: {
          times: 5,
        },
      });
      const emitter = instance['emitter'];
      await instance.push(1);

      // Need to wait on low thread count because the scheduler can be executed on the next tick.
      await instance.flush({
        waitForHandler: true,
      });
      await instance.flush({
        waitForHandler: true,
      });

      expect(emitter.emit).toHaveBeenCalledWith(
        EVENTS.FLUSH_RETRYING,
        createReturnValue(1),
      );
      expect(emitter.emit).toHaveBeenCalledWith(
        EVENTS.FLUSH_RETRYING,
        createReturnValue(2),
      );
      expect(emitter.emit).toHaveBeenCalledWith(
        EVENTS.FLUSH_RETRYING,
        createReturnValue(3),
      );
      expect(emitter.emit).toHaveBeenCalledWith(
        EVENTS.FLUSH_RETRYING,
        createReturnValue(4),
      );
      expect(emitter.emit).toHaveBeenCalledWith(
        EVENTS.FLUSH_RETRYING,
        createReturnValue(5),
      );
    },
  );
});
