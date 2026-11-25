import { HttpException, HttpStatus, Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

/**
 * Fixed-window counter per key. In memory, so limits are per API instance;
 * move to a shared store (Redis, Postgres) if the API runs on several.
 */
export class FixedWindowLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  /** Count one hit for `key`; returns whether it is allowed and when to retry. */
  hit(key: string, now = Date.now()): { allowed: boolean; retryAfterSec: number } {
    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      this.prune(now);
      return { allowed: true, retryAfterSec: 0 };
    }
    entry.count += 1;
    const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: entry.count <= this.limit, retryAfterSec };
  }

  /** Drop expired windows so the map can't grow without bound. */
  private prune(now: number) {
    if (this.hits.size < 10_000) return;
    for (const [key, e] of this.hits) if (e.resetAt <= now) this.hits.delete(key);
  }
}

/**
 * Limits state-changing requests (every POST: transaction builders, submit,
 * remittance recording) per client IP. RATE_LIMIT_PER_MINUTE, default 60.
 */
@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly limiter = new FixedWindowLimiter(
    Number(process.env.RATE_LIMIT_PER_MINUTE) || 60,
    60_000,
  );

  use(req: Request, res: Response, next: NextFunction) {
    const { allowed, retryAfterSec } = this.limiter.hit(req.ip ?? 'unknown');
    if (!allowed) {
      res.setHeader('Retry-After', String(retryAfterSec));
      throw new HttpException(
        `Too many requests. Try again in ${retryAfterSec}s.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    next();
  }
}
