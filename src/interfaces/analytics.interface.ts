export interface IAnalytics {
  flush: {
    invoked: number;
    scheduled: number;
    executed: number;
    errors: number;
    processTime: number;
  };

  thread: {
    active: number;
    opened: number;
    closed: number;
  };

  queue: {
    waiting: number;
  };

  record: {
    received: number;
  };
}
