import type { Request, Response, NextFunction } from "express";
import Redis from "ioredis";
import {
  RateLimiterRedis,
  RateLimiterMemory,
  type RateLimiterRes,
} from "rate-limiter-flexible"; 

/**
 * Redis client — shared, single instance.
 * Uses REDIS_URL if provided; otherwise falls back to localhost defaults.
 */
export const redis = new Redis(process.env.REDIS_URL ?? "", {
  // Safe defaults for local dev if REDIS_URL is empty:
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: 2, // fail fast
  enableReadyCheck: true,
  lazyConnect: true,       // connect only if used
});

/**
 * Helper: turn milliseconds into a human string (for error messages).
 */
function human(ms: number) {
  const sec = Math.ceil(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.ceil(sec / 60);
  if (min < 60) return `${min}m`;
  const hrs = Math.ceil(min / 60);
  return `${hrs}h`;
}

/**
 * Core factory: creates a rate-limiter middleware.
 * - Tries Redis first (distributed). If Redis is down, falls back to in-memory limiter
 *   so your API remains usable (best-effort protection).
 */
function buildLimiter({
  keyPrefix,
  points,
  durationSeconds,
  blockSeconds = 0,
}: {
  keyPrefix: string;      // namespace key to separate limiters in Redis
  points: number;         // how many requests allowed per window
  durationSeconds: number;// window length in seconds
  blockSeconds?: number;  // optional: block window after exhausting points
}) {
  // Primary: Redis limiter
  const redisLimiter = new RateLimiterRedis({
    storeClient: redis,
    keyPrefix,
    points,
    duration: durationSeconds,
    blockDuration: blockSeconds, // 0 = no block, otherwise temp ban
    insuranceLimiter: new RateLimiterMemory({
      keyPrefix: `${keyPrefix}:insurance`, // fallback memory limiter
      points,
      duration: durationSeconds,
      blockDuration: blockSeconds,
    }),
  });

  // Return Express middleware
  return async (req: Request, res: Response, next: NextFunction) => {
    // choose a stable key per client. Use IP by default.
    // For authenticated routes, you could use userId instead.
    const key = req.ip || req.headers["x-forwarded-for"]?.toString() || "anonymous";

    try {
      // consume 1 point for this request
      const result = await redisLimiter.consume(key, 1);

      // Expose standard RateLimit-* headers (RFC)
      // https://datatracker.ietf.org/doc/html/draft-polli-ratelimit-headers
      res.setHeader("RateLimit-Limit", String(points));
      res.setHeader(
        "RateLimit-Remaining",
        String(Math.max(0, result.remainingPoints))
      );
      res.setHeader(
        "RateLimit-Reset",
        String(Math.ceil(result.msBeforeNext / 1000))
      );

      return next();
    } catch (err) {
      // When limit exceeded, rate-limiter-flexible throws a RateLimiterRes
      const rlErr = err as RateLimiterRes;

      // Headers still help the client know when to retry
      res.setHeader("RateLimit-Limit", String(points));
      res.setHeader("RateLimit-Remaining", "0");
      res.setHeader(
        "RateLimit-Reset",
        String(Math.ceil(rlErr?.msBeforeNext ? rlErr.msBeforeNext / 1000 : durationSeconds))
      );

      // Optional legacy header many clients still parse
      res.setHeader(
        "Retry-After",
        String(Math.ceil((rlErr?.msBeforeNext ?? 1000) / 1000))
      );

      const blocked =
        typeof rlErr?.msBeforeNext === "number" && rlErr.msBeforeNext > durationSeconds * 1000;

      // Human-friendly message, but minimal to avoid leaking internals
      const msg = blocked
        ? `Too many requests — temporarily blocked. Try again in ${human(
            rlErr.msBeforeNext
          )}.`
        : `Too many requests — try again in ${human(
            rlErr?.msBeforeNext ?? durationSeconds * 1000
          )}.`;

      return res.status(429).json({
        success: false,
        error: "rate_limited",
        message: msg,
      });
    }
  };
}

/**
 * Concrete limiters for TrackNest v1
 * ----------------------------------
 * - generalLimiter: defaults for all routes (burst protection)
 * - authLimiter: stricter limits for login/signup (brute-force defense)
 * - panicLimiter: balanced throttle for emergency triggers
 */
export const generalLimiter = buildLimiter({
  keyPrefix: "rl:general",
  points: 100,               // 100 requests
  durationSeconds: 15 * 60,  // per 15 minutes
});

export const authLimiter = buildLimiter({
  keyPrefix: "rl:auth",
  points: 5,                 // 5 attempts
  durationSeconds: 10 * 60,  // per 10 minutes
  blockSeconds: 15 * 60,     // block 15 minutes after abuse
});

export const panicButtonLimiter = buildLimiter({
  keyPrefix: "rl:panic",
  points: 3,                 // 3 triggers
  durationSeconds: 60,       // per 1 minute
  // no block by default — panic should recover quickly
});