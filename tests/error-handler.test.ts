import { EVENTS } from '../src/events';
import { Resistor } from '../src/resistor';

describe('Flush Error Handler', () => {
  test('Dispatch the error caused by the handler', done => {
    const handler = async () => {
      throw new Error('ByHandler');
    };
    const instance = new Resistor<string>(handler, {
      buffer: {
        size: 1,
      },
      autoFlush: false,
    });

    instance.push('e');

    instance.on(EVENTS.FLUSH_REJECTED, ({ rejection, errors }) => {
      expect(errors).toBe(1);
      expect(rejection.message).toBe('ByHandler');
      instance.deregister();
      done();
    });
  });
});

describe('Flush Retrier', () => {
  test('Should retry twice on error', done => {
    const handler = async () => {
      throw new Error('ByHandler');
    };
    const instance = new Resistor<string>(handler, {
      buffer: {
        size: 1,
      },
      autoFlush: false,
      retrier: {
        times: 2,
      },
    });

    instance.push('e');

    instance.on(EVENTS.FLUSH_RETRYING, ({ retries }) => {
      if (retries === 2) {
        instance.deregister();
        done();
      }
    });
  });
});
