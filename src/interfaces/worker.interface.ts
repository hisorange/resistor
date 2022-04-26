export type ISingleRecordWorker<I> = (
  record: I,
  threadId: number,
) => Promise<void>;
export type IBufferedWorker<I> = (
  records: I[],
  threadId: number,
) => Promise<void>;

export type IWorker<I> = IBufferedWorker<I> | ISingleRecordWorker<I>;
