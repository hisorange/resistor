import { Resistor } from '../src/resistor';

describe('Single Record', () => {
  test('Pass a single record when the buffer size is 1', async () => {
    const worker = async (input: number) => {
      expect(input).toBe(1);
    };
    const instance = new Resistor(worker, {
      buffer: {
        size: 1,
      },
      autoFlush: false,
    });

    await instance.push(1);
  });
});
