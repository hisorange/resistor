![Resistor](https://user-images.githubusercontent.com/3441017/119745067-ab632600-be8d-11eb-93e1-24d34ffe2a92.png)

## Resistor - Versatily Green Threaded Resource Loading Throttler

[![Version](https://badge.fury.io/gh/hisorange%2Fresistor.svg)](https://badge.fury.io/gh/hisorange%2Fresistor)
[![Build](https://github.com/hisorange/resistor/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/hisorange/resistor/actions/workflows/ci.yml)
[![Coverage Status](https://coveralls.io/repos/github/hisorange/resistor/badge.svg)](https://coveralls.io/github/hisorange/resistor)
[![GitHub license](https://img.shields.io/github/license/hisorange/resistor)](https://github.com/hisorange/resistor/blob/main/LICENSE)

Versatily resource load throttler with extensible strategies, configuration and virtual thread management. This packages provides a solution to limit and contol the your worker's invocation, and by this feature you can easily implement any resource usage limiter into your flow.

I wrote this package because I know how boring is to rewrite the bulk save, and API limiters for every high throughput flow, and this is why the Resistor accepts a generic async worker so You can implement any kind of work which requires control over the resource loading.

### Getting Started

---

```sh
npm i @hisorange/resistor
# or
yarn add @hisorange/resistor
```

### Strategy - Interval

---

Enforces a minimum invocation time for cases when the worker should wait the given amount of miliseconds between calls.
In this example we start a new HTTP call every 5 second, in 2 parallel virtual threads.

```ts
import { Resistor, IntervalStrategy } from '@hisorange/resistor';

const worker = async (url: string) => fetch(url);
const buffer = new Resistor<string>(worker, {
  threads: 2,
  buffer: false,
  limiter: {
    level: 'thread', // Applied to each thread individually
    strategy: new IntervalStrategy({
      interval: 5000,
    }),
  },
});

// Not blocking just starts the work.
await buffer.push('https://hisorange.me');
await buffer.push('https://google.com');
// Will wait 5 second until the worker can start the work.
await buffer.push('https://github.com');
```

### Strategy - Rate Limiter

---

Monitors the invocations frequency and requlates them in a given interval, most commonly used by external APIs with rules like 100 call / minute.
In this example we send 5 user on 10 thread, but still respecting a global 10 call / second limit.

```ts
import { Resistor, RateLimiterStrategy } from '@hisorange/resistor';

const worker = async (users: string[]) =>
  axios.post('https://mockapi.io/test', users);
const buffer = new Resistor<string>(worker, {
  threads: 10,
  buffer: {
    size: 5,
  },
  limiter: {
    level: 'global', // Applied to every thread in aggregate
    strategy: new RateLimiterStrategy({
      interval: 1000,
      occurrence: 10,
    }),
  },
});

// Not blocking just starts the work.
await buffer.push('admin');
await buffer.push('user1');
await buffer.push('user2');
/// ... Will return a blocking promise when the rate limiter strategy reached it's limit.
```

### Strategy - Unbound

---

Basic active thread limiter which simply enforces the thread to execute one job at a time, mostly useful for database related actions where the worker should not use too many connection.
In this example we send 5 user in a batch on 5 thread, but we do not wait between calls, the scheduler will call the next buffer when any thread is free to do so.

```ts
import { Resistor, UnboundStrategy } from '@hisorange/resistor';

const worker = async (users: string[]) =>
  sequelize.insertMany('myUsers', users);
const buffer = new Resistor<string>(worker, {
  threads: 5,
  buffer: {
    size: 10,
  },
  limiter: {
    strategy: new UnboundStrategy(),
  },
});

// Not blocking just starts the work.
await buffer.push('admin');
await buffer.push('user1');
await buffer.push('user2');
/// ... Will return a blocking promise when the rate limiter strategy reached it's limit.
```

### Auto Flush

---

Many times your buffer will not gona be filled to the exact maximum you set, and some records would hang around without ever being flushed out. This is where the auto flush comes in, you can provide an interval in the config which will be continouosly delayed from the last flush, and if when executed it will trigger a flush even if the buffer is not at its maximum.

```ts
const buffer = new Resistor<string>(() => Promise.resolve(), {
  autoFlush: {
    interval: 5_000, // Wait maximum 5 second before flushing the buffer.
  },
});
```

### Events

---

To provide hooks the package comes with an **EventEmitter** implementation, and supports the following events.

| Event                    | Description                                                                         |
| ------------------------ | ----------------------------------------------------------------------------------- |
| `.on('flush.invoked')`   | Emitted when the flush handler is invoked either by auto flush, or the buffer.      |
| `.on('flush.scheduled')` | Emitted when the flush handler has active buffer to be passed to the scheduler.     |
| `.on('flush.executed')`  | Emitted when the scheduler executed the worker.                                     |
| `.on('worker.rejected')` | Emitted when the provided worker thrown an unhandled promise rejection.             |
| `.on('worker.retrying')` | Emitted when the provided worker is rescheduled due to unhandled promise rejection. |
| `.on('thread.opened')`   | Emitted after a new thread has been opened by the scheduler.                        |
| `.on('thread.closed')`   | Emitted after a thread has been closed by the scheduler.                            |
| `.on('queue.empty')`     | Emitted when the scheduler's waiting queue is empty.                                |
| `.on('empty')`           | Emitted when the resistor is absolutely empty.                                      |

### Retry Handler

---

When the worker throws an unhandled rejection, the resistor can schedule it for one more execution. By default this is turned off, because You can subscribe to the worker.rejected event and could handle the error by yourself, but if your workload allows a simple requeue without outside effect, then simply set the retry times to your desired value. Important to note, each retry will block the same thread until it's either solved or runs out of retry chances, but everytime the resistor will emit the worker.rejected and worker.retrying event with the respective information to handle.

```ts
const buffer = new Resistor<string>(() => Promise.resolve(), {
  retries: {
    timer: 50, // Reschedule the job 50 times maximum before giving up on it.
  },
});
```

### Error Handling

---

It's painful to lose records in an asynchronus workflow, this is why the resistor emits an worker.rejected event with the failing records, so You can apply your custom logic. The best case would be to handle the error in the given worker fn, but this is a failsafe in case if anything slips through the worker.

### Analytics / Health Check

---

Measure what matters! But seriously, to implement a healthcheck or any monitoring, the package provides a full fledged analytics system to help you understand and optimize your workload :)

```ts
const usage = resistor.analytics;

{
  flush: {
    invoked: 0,
    scheduled: 0,
    executed: 0,
    errors: 0,
    processTime: 0,
  };

  thread: {
    active: 0,
    opened: 0,
    closed: 0,
    maximum: 0,
  };

  queue: {
    waiting: 0,
    maximum: 0,
  };

  record: {
    received: 0,
    buffered: 0,
  };
};
```

### Whats with the name?

---

When I drafted the flow diagram for the features, I realised that this functionality is most similiar to what a resistor does in a circuit, if You implement it with an await keyword then your business logic's throughput will limit to what the slowest component allows, and this is utmost important when You don't want to melt down any API or database.

### Links

---

- [GitHub](https://github.com/hisorange/resistor)
- [NPM](https://www.npmjs.com/package/@hisorange/resistor)

### Changelog

---

Track changes in the [Changelog](./changelog.md)
