import { FixedWindowLimiter } from './rate-limit';

describe('FixedWindowLimiter', () => {
  it('allows up to the limit within a window, then blocks', () => {
    const limiter = new FixedWindowLimiter(3, 60_000);
    const results = [1, 2, 3, 4].map(() => limiter.hit('ip-a', 1_000).allowed);
    expect(results).toEqual([true, true, true, false]);
  });

  it('tells the client when to retry', () => {
    const limiter = new FixedWindowLimiter(1, 60_000);
    limiter.hit('ip-a', 0);
    expect(limiter.hit('ip-a', 15_000)).toEqual({ allowed: false, retryAfterSec: 45 });
  });

  it('opens a new window after the old one ends', () => {
    const limiter = new FixedWindowLimiter(1, 60_000);
    limiter.hit('ip-a', 0);
    expect(limiter.hit('ip-a', 60_000).allowed).toBe(true);
  });

  it('counts each client separately', () => {
    const limiter = new FixedWindowLimiter(1, 60_000);
    limiter.hit('ip-a', 0);
    expect(limiter.hit('ip-b', 0).allowed).toBe(true);
  });
});
