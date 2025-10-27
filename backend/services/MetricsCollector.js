// Please write clean, production-grade JavaScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Metrics Collector for AI Provider Service
 * Tracks performance, errors, and usage statistics
 */
class MetricsCollector {
  constructor() {
    this.metrics = {
      requests: new Map(),
      errors: new Map(),
      latencies: new Map(),
      tokens: new Map()
    };
    this.startTime = Date.now();
  }

  /**
   * Record successful request
   * @param {string} provider - Provider name
   * @param {number} latency - Request latency in ms
   * @param {number} tokens - Number of tokens used (optional)
   */
  recordSuccess(provider, latency, tokens = 0) {
    const key = `success_${provider}`;
    this.metrics.requests.set(key, (this.metrics.requests.get(key) || 0) + 1);
    this.metrics.latencies.set(key, latency);
    
    if (tokens > 0) {
      this.metrics.tokens.set(key, (this.metrics.tokens.get(key) || 0) + tokens);
    }
  }

  /**
   * Record failed request
   * @param {string} provider - Provider name
   * @param {Error} error - Error object
   * @param {number} latency - Request latency in ms
   */
  recordError(provider, error, latency) {
    const key = `error_${provider}`;
    this.metrics.errors.set(key, (this.metrics.errors.get(key) || 0) + 1);
    
    console.error(`[METRICS] ${provider} error:`, {
      message: error.message,
      latency: latency,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get all metrics
   * @returns {Object} Complete metrics object
   */
  getMetrics() {
    const uptime = Date.now() - this.startTime;
    
    return {
      uptime: uptime,
      requests: Object.fromEntries(this.metrics.requests),
      errors: Object.fromEntries(this.metrics.errors),
      latencies: Object.fromEntries(this.metrics.latencies),
      tokens: Object.fromEntries(this.metrics.tokens),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get metrics for specific provider
   * @param {string} provider - Provider name
   * @returns {Object} Provider-specific metrics
   */
  getProviderMetrics(provider) {
    return {
      requests: this.metrics.requests.get(`success_${provider}`) || 0,
      errors: this.metrics.errors.get(`error_${provider}`) || 0,
      avgLatency: this.metrics.latencies.get(`success_${provider}`) || 0,
      tokens: this.metrics.tokens.get(`success_${provider}`) || 0
    };
  }

  /**
   * Reset all metrics
   */
  reset() {
    this.metrics.requests.clear();
    this.metrics.errors.clear();
    this.metrics.latencies.clear();
    this.metrics.tokens.clear();
    this.startTime = Date.now();
  }

  /**
   * Get success rate for provider
   * @param {string} provider - Provider name
   * @returns {number} Success rate (0-1)
   */
  getSuccessRate(provider) {
    const requests = this.metrics.requests.get(`success_${provider}`) || 0;
    const errors = this.metrics.errors.get(`error_${provider}`) || 0;
    const total = requests + errors;
    
    return total > 0 ? requests / total : 0;
  }
}

module.exports = MetricsCollector;
