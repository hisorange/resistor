export type Handler<I> = (records: I[]) => Promise<void>;
