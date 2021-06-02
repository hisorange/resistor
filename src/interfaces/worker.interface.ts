export type IWorker<I> = (records: I[]) => Promise<void>;
