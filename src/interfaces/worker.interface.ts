export type IWorker<I> = (records: I, jobId: number) => Promise<void>;
