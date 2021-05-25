import { WaitPass } from './wait-pass.interface';

export interface IStrategy {
  handleWaitPass(threadId: number, waitPass: WaitPass): void;
  threadFinished(threadId: number, finishedAt: number): void;
}
