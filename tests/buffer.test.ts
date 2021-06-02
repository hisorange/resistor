import { Resistor } from '../src/resistor';

/**
 * Test the buffer feature
 */
jest.setTimeout(100);

describe('Buffer', () => {
  test.each([1, 2, 4, 8, 64])(
    'should respect the maximum [%i] record limit',
    async (bufferMax: number) => {
      const worker = async (records: number[]) => {
        expect(records.length).toBeLessThanOrEqual(bufferMax);
      };
      const instance = new Resistor(worker, {
        buffer: {
          size: bufferMax,
        },
        autoFlush: false,
      });

      for (let i = 0; i < bufferMax * 12; i++) {
        instance.push(i);
      }

      await instance.deregister();

      expect(instance.analytics.record.received).toBe(bufferMax * 12);
      expect(instance.analytics.record.buffered).toBe(0);
    },
  );
});
