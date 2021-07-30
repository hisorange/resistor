import { EVENTS } from '../src/events';
import { Resistor } from '../src/resistor';

/**
 * Test worker related features
 */
jest.setTimeout(100);

describe('Worker Error', () => {
  test('Dispatch the error caused by the worker', done => {
    const worker = async () => {
      throw new Error('ByWorker');
    };
    const instance = new Resistor<string>(worker, {
      buffer: {
        size: 1,
      },
      autoFlush: false,
    });

    instance.push('e');

    instance.on(EVENTS.WORKER_REJECTED, (data: any) => {
      expect(data.errors).toBe(1);
      expect(data.rejection.message).toBe('ByWorker');
      instance.deregister();
      done();
    });
  });
});

describe('Worker Retry', () => {
  test('Should retry twice on error', done => {
    const worker = async () => {
      throw new Error('ByWorker');
    };
    const instance = new Resistor<string>(worker, {
      buffer: {
        size: 1,
      },
      autoFlush: false,
      retrier: {
        times: 2,
      },
    });

    instance.push('e');

    instance.on(EVENTS.WORKER_RETRYING, (data: any) => {
      if (data.retries === 2) {
        instance.deregister();
        done();
      }
    });
  });
});
