import { IStrategy } from '../interfaces/strategy.interface';
import { WaitPass } from '../interfaces/wait-pass.interface';

export class UnboundStrategy implements IStrategy {
  async handleWaitPass(threadId: number, waitPass: WaitPass): Promise<void> {
    waitPass();
  }

  threadFinished(): void {
    // Function does not need to track anything.
  }
}
