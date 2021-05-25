import { IStrategy } from '../interfaces/strategy.interface';
import { WaitPass } from '../interfaces/wait-pass.interface';

export class UnboundStrategy implements IStrategy {
  constructor() {}

  async handleWaitPass(threadId: number, waitPass: WaitPass) {
    waitPass();
  }

  threadFinished() {}
}
