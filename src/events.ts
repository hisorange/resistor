export enum EVENTS {
  FLUSH_INVOKED = 'flush.invoked',
  FLUSH_SCHEDULED = 'flush.scheduled',
  FLUSH_EXECUTED = 'flush.executed',

  WORKER_REJECTED = 'worker.rejected',
  WORKER_RETRYING = 'worker.retrying',

  THREAD_OPENED = 'thread.opened',
  THREAD_CLOSED = 'thread.closed',

  QUEUE_EMPTY = 'queue.empty',

  EMPTY = 'empty',
}
