export type IHandler<I> = (records: I[]) => Promise<void>;
