import { Resistor } from '../src/resistor';

describe('Auto Flush', () => {
  test('Flush on timer without reaching the max size', done => {
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

  test('Flush on the leftover', done => {
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
