![Resistor](https://user-images.githubusercontent.com/3441017/119745067-ab632600-be8d-11eb-93e1-24d34ffe2a92.png)

---

Easiest virtual threading for situations when you need to respect some kind of resource processing limitations.
Detailed documentation and use cases are comming soon.


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
      })
    }
  }
);

await buffer.push('https://hisorange.me');
await buffer.push('https://google.com');
```
