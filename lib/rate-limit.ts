// 简单的内存 Rate Limiting 实现
// 注意：在多实例部署时需要使用 Redis 等外部存储

import type { RateLimitRecord, RateLimitResult } from './types';

const rateLimit = new Map<string, RateLimitRecord>();

const RATE_LIMIT = {
  windowMs: 60 * 1000, // 1 分钟
  max: 20, // 每分钟最多 20 次请求
};

// 定期清理过期记录，避免内存泄漏
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 分钟

let lastCleanup = Date.now();

function cleanupExpiredRecords() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) {
    return;
  }

  lastCleanup = now;
  const entries = Array.from(rateLimit.entries());
  for (const [ip, record] of entries) {
    if (now > record.resetTime) {
      rateLimit.delete(ip);
    }
  }
}

export { type RateLimitResult };

export function checkRateLimit(ip: string): RateLimitResult {
  cleanupExpiredRecords();

  const now = Date.now();
  const record = rateLimit.get(ip);

  if (!record || now > record.resetTime) {
    rateLimit.set(ip, { count: 1, resetTime: now + RATE_LIMIT.windowMs });
    return { allowed: true, remaining: RATE_LIMIT.max - 1 };
  }

  if (record.count >= RATE_LIMIT.max) {
    return {
      allowed: false,
      retryAfter: Math.ceil((record.resetTime - now) / 1000),
      remaining: 0,
    };
  }

  record.count++;
  return { allowed: true, remaining: RATE_LIMIT.max - record.count };
}
