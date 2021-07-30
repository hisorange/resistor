import { Resistor } from '../src/resistor';

/**
 * Test the auto flush feature
 */
jest.setTimeout(100);

describe('Auto Flush', () => {
  test('Flush on timer without reaching the max size', done => {
    const worker = async (records: number[]) => {
      expect(records).toEqual(expect.arrayContaining([1, 2, 3]));

      instance.deregister();
      done();
    };

    const instance = new Resistor<number>(worker, {
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

  test('Flush on the leftover', done => {
    const worker = async (records: number[]) => {
      if (records.length === 2) {
        expect(records).toEqual(expect.arrayContaining([1, 2]));
      } else {
        expect(records).toEqual(expect.arrayContaining([3]));
        instance.deregister();
        done();
      }
    };

    const instance = new Resistor<number>(worker, {
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
