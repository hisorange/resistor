import { EVENTS, IHandler, Resistor } from '../src';

/**
 * Tests for the event emitter feature.
 */

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

describe('Event Proxy', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test('should register the event listener', () => {
    const instance = createTestInstance();
    const emitter = instance['emitter'];
    const listener = () => {};

    instance.on(EVENTS.THREAD_OPENED, listener);

    expect(emitter.on).toBeCalledTimes(1);
    expect(emitter.on).toBeCalledWith(EVENTS.THREAD_OPENED, listener);

    instance.deregister();
  });

  test('should register the event listener once', () => {
    const instance = createTestInstance();
    const emitter = instance['emitter'];
    const listener = () => {};

    instance.once(EVENTS.THREAD_OPENED, listener);

    expect(emitter.once).toBeCalledTimes(1);
    expect(emitter.once).toBeCalledWith(EVENTS.THREAD_OPENED, listener);

    instance.deregister();
  });

  test('should deregister the event listener', () => {
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
