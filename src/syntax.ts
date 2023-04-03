import { IWorker } from './interfaces/worker.interface';
import { Resistor } from './resistor';

export const threadIt = <R = unknown>(
  worker: IWorker<R>,
  threads: number = 8,
) =>
  new Resistor(worker, {
    buffer: {
      size: 1,
    },
    threads,
  });
