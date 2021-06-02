export interface IAnalytics {
  worker: {
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
    maximum: number;
  };

  queue: {
    waiting: number;
    maximum: number;
  };

  record: {
    received: number;
    buffered: number;
  };
}
