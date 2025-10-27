// Please write clean, production-grade JavaScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Rate Limiter for AI Providers
 * Prevents API abuse and controls costs
 */
class RateLimiter {
  constructor() {
    this.requests = new Map();
    this.limits = {
      openai: { requests: 100, window: 60000 }, // 100 req/min
      groq: { requests: 200, window: 60000 }     // 200 req/min
    };
    this.blocked = new Set();
  }

  /**
   * Check if request is allowed
   * @param {string} provider - Provider name
   * @param {string} identifier - Request identifier (IP, user ID, etc.)
   * @returns {Object} Rate limit result
   */
  isAllowed(provider, identifier = 'global') {
    const key = `${provider}_${identifier}`;
    const now = Date.now();
    const limit = this.limits[provider];
    
    if (!limit) {
      return { allowed: true, remaining: Infinity, resetTime: now + 60000 };
    }

    // Check if identifier is blocked
    if (this.blocked.has(key)) {
      return { 
        allowed: false, 
        reason: 'blocked', 
        remaining: 0, 
        resetTime: now + limit.window 
      };
    }

    if (!this.requests.has(key)) {
      this.requests.set(key, { count: 1, resetTime: now + limit.window });
      return { 
        allowed: true, 
        remaining: limit.requests - 1, 
        resetTime: now + limit.window 
      };
    }

    const record = this.requests.get(key);
    
    // Reset window if expired
    if (now > record.resetTime) {
      record.count = 1;
      record.resetTime = now + limit.window;
      return { 
        allowed: true, 
        remaining: limit.requests - 1, 
        resetTime: record.resetTime 
      };
    }

    // Check if limit exceeded
    if (record.count >= limit.requests) {
      // Block for the remaining window time
      this.blocked.add(key);
      setTimeout(() => {
        this.blocked.delete(key);
        console.log(`[RATE_LIMITER] 🔓 Unblocked ${key} after window reset`);
      }, record.resetTime - now);

      console.log(`[RATE_LIMITER] 🚫 Rate limit exceeded for ${key} - blocked until ${new Date(record.resetTime).toISOString()}`);
      
      return { 
        allowed: false, 
        reason: 'rate_limit_exceeded', 
        remaining: 0, 
        resetTime: record.resetTime 
      };
    }

    record.count++;
    return { 
      allowed: true, 
      remaining: limit.requests - record.count, 
      resetTime: record.resetTime 
    };
  }

  /**
   * Get rate limit status for identifier
   * @param {string} provider - Provider name
   * @param {string} identifier - Request identifier
   * @returns {Object} Rate limit status
   */
  getStatus(provider, identifier = 'global') {
    const key = `${provider}_${identifier}`;
    const now = Date.now();
    const limit = this.limits[provider];
    
    if (!limit) {
      return { limit: Infinity, remaining: Infinity, resetTime: now + 60000 };
    }

    const record = this.requests.get(key);
    if (!record) {
      return { limit: limit.requests, remaining: limit.requests, resetTime: now + limit.window };
    }

    const remaining = Math.max(0, limit.requests - record.count);
    return {
      limit: limit.requests,
      remaining: remaining,
      resetTime: record.resetTime,
      blocked: this.blocked.has(key)
    };
  }

  /**
   * Update rate limits for provider
   * @param {string} provider - Provider name
   * @param {Object} limits - New limits
   */
  updateLimits(provider, limits) {
    this.limits[provider] = { ...this.limits[provider], ...limits };
    console.log(`[RATE_LIMITER] ⚙️ Updated limits for ${provider}:`, this.limits[provider]);
  }

  /**
   * Reset rate limit for identifier
   * @param {string} provider - Provider name
   * @param {string} identifier - Request identifier
   */
  reset(provider, identifier = 'global') {
    const key = `${provider}_${identifier}`;
    this.requests.delete(key);
    this.blocked.delete(key);
    console.log(`[RATE_LIMITER] 🔄 Reset rate limit for ${key}`);
  }

  /**
   * Reset all rate limits
   */
  resetAll() {
    this.requests.clear();
    this.blocked.clear();
    console.log(`[RATE_LIMITER] 🔄 Reset all rate limits`);
  }

  /**
   * Get all rate limit statistics
   * @returns {Object} All rate limit statistics
   */
  getStatistics() {
    const stats = {};
    for (const [key, record] of this.requests) {
      const [provider, identifier] = key.split('_', 2);
      if (!stats[provider]) {
        stats[provider] = {};
      }
      stats[provider][identifier] = {
        count: record.count,
        resetTime: record.resetTime,
        blocked: this.blocked.has(key)
      };
    }
    return stats;
  }
}

module.exports = RateLimiter;
