export enum EVENTS {
  FLUSH_INVOKED = 'flush.invoked',
  FLUSH_SCHEDULED = 'flush.scheduled',
  FLUSH_EXECUTED = 'flush.executed',

  FLUSH_RETRIED = 'flush.retried',
  FLUSH_ERROR = 'flush.error',

  THREAD_OPENED = 'thread.opened',
  THREAD_CLOSED = 'thread.closed',

  QUEUE_EMPTY = 'queue.empty',
}
