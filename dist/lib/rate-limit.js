const rateLimit = new Map();
const RATE_LIMIT = {
    windowMs: 60 * 1000,
    max: 20,
};
const CLEANUP_INTERVAL = 5 * 60 * 1000;
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
export function checkRateLimit(ip) {
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
//# sourceMappingURL=rate-limit.js.map