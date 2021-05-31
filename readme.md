![Resistor](https://user-images.githubusercontent.com/3441017/119745067-ab632600-be8d-11eb-93e1-24d34ffe2a92.png)

---

Easy to use resource load throttler with extensible strategies and configuration. This packages provides a solution to limit and contol the given handler's invocation with this you can easily implement any resource usage limiter.

I wrote this package because I know how boring is to rewrite the bulk save, and API limiters for every high throughput flow, and this is why the Resistor accepts a generic async handler so You can implement any kind of work which requires control over the resource loading.

### Quick example

```ts
import { Resistor, RateLimiterStrategy } from '@hisorange/resistor';

const buffer = new Resistor<string>(
  async (urls: string[]) => urls.forEach(url => fetch(url)),
  {
    threads: 10,
    buffer: {
      size: 1000,
    },
    limiter: {
      level: 'thread',
      strategy: new RateLimiterStrategy({
        interval: 10_000,
        occurrence: 50,
      }),
    },
  },
);

await buffer.push('https://hisorange.me');
await buffer.push('https://google.com');
```

### Strategies

---

Limiting can be handled in many different ways, this is why the resister comes with some built in strategies.

- **IntervalStrategy** enforces a minimum invocation time for cases when the handler should wait the given amount of miliseconds between calls.
- **RateLimiterStrategy** this strategy monitors the invocations frequency and requlates them in a given interval, most commonly used by external APIs with rules like 100 call / minute.
- **UnboundStrategy** is a basic active thread limiter which simply enforces the thread to execute one job at a time, mostly useful for database related actions where the handler should not use too many connection.

### Events

---

To provide hooks the package comes with an **EventEmitter** implementation, and supports the following events.

| Event                    | Description                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------ |
| `.on('flush.invoked')`   | Emitted when the flush handler is invoked either by auto flush, or the buffer.       |
| `.on('flush.scheduled')` | Emitted when the flush hander has active buffer to be passed to the scheduler.       |
| `.on('flush.executed')`  | Emitted when the scheduler executed the handler.                                     |
| `.on('flush.rejected')`  | Emitted when the provided handler thrown an unhandled promise rejection.             |
| `.on('flush.retrying')`  | Emitted when the provided handler is rescheduled due to unhandled promise rejection. |
| `.on('thread.opened')`   | Emitted after a new thread has been opened by the scheduler.                         |
| `.on('thread.closed')`   | Emitted after a thread has been closed by the scheduler.                             |
| `.on('queue.empty')`     | Emitted when the scheduler's waiting queue is empty.                                 |

### Why the name?

When I drafted the flow diagram for the features, I realised that this functionality is most similiar to what a resistor does in a circuit, if You implement it with an await keyword then your business logic's throughput will limit to what the slowest component allows, and this is utmost important when You don't want to melt down any API or database.
