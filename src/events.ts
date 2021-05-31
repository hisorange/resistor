export enum EVENTS {
  FLUSH_INVOKED = 'flush.invoked',
  FLUSH_SCHEDULED = 'flush.scheduled',
  FLUSH_EXECUTED = 'flush.executed',

  FLUSH_REJECTED = 'flush.rejected',
  FLUSH_RETRYING = 'flush.retrying',

  THREAD_OPENED = 'thread.opened',
  THREAD_CLOSED = 'thread.closed',

  QUEUE_EMPTY = 'queue.empty',
}
