// Please write clean, production-grade JavaScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

const CircuitBreaker = require('opossum');

/**
 * Circuit Breaker Manager for AI Providers
 * Provides enterprise-grade fault tolerance
 */
class CircuitBreakerManager {
  constructor() {
    this.breakers = new Map();
    this.config = {
      timeout: 30000,
      errorThresholdPercentage: 50,
      resetTimeout: 60000,
      rollingCountTimeout: 10000,
      rollingCountBuckets: 10
    };
  }

  /**
   * Create circuit breaker for provider
   * @param {string} provider - Provider name
   * @param {Function} operation - Operation to wrap
   * @param {Object} options - Circuit breaker options
   * @returns {CircuitBreaker} Circuit breaker instance
   */
  createBreaker(provider, operation, options = {}) {
    const breakerOptions = {
      ...this.config,
      ...options
    };

    const breaker = new CircuitBreaker(operation, breakerOptions);

    // Event handlers
    breaker.on('open', () => {
      console.log(`[CIRCUIT_BREAKER] 🔴 ${provider} circuit opened - too many failures`);
    });

    breaker.on('halfOpen', () => {
      console.log(`[CIRCUIT_BREAKER] 🟡 ${provider} circuit half-opened - testing recovery`);
    });

    breaker.on('close', () => {
      console.log(`[CIRCUIT_BREAKER] 🟢 ${provider} circuit closed - service recovered`);
    });

    breaker.on('failure', (error) => {
      console.error(`[CIRCUIT_BREAKER] ❌ ${provider} failure:`, error.message);
    });

    breaker.on('success', () => {
      console.log(`[CIRCUIT_BREAKER] ✅ ${provider} success - circuit healthy`);
    });

    this.breakers.set(provider, breaker);
    return breaker;
  }

  /**
   * Get circuit breaker for provider
   * @param {string} provider - Provider name
   * @returns {CircuitBreaker|null} Circuit breaker instance
   */
  getBreaker(provider) {
    return this.breakers.get(provider);
  }

  /**
   * Get circuit breaker status for provider
   * @param {string} provider - Provider name
   * @returns {Object} Circuit breaker status
   */
  getBreakerStatus(provider) {
    const breaker = this.breakers.get(provider);
    if (!breaker) {
      return { status: 'not_configured' };
    }

    return {
      status: breaker.state,
      failures: breaker.failures,
      successes: breaker.successes,
      fallback: breaker.fallback ? 'configured' : 'not_configured'
    };
  }

  /**
   * Get all circuit breaker statuses
   * @returns {Object} All circuit breaker statuses
   */
  getAllBreakerStatuses() {
    const statuses = {};
    for (const [provider, breaker] of this.breakers) {
      statuses[provider] = this.getBreakerStatus(provider);
    }
    return statuses;
  }

  /**
   * Reset circuit breaker for provider
   * @param {string} provider - Provider name
   */
  resetBreaker(provider) {
    const breaker = this.breakers.get(provider);
    if (breaker) {
      breaker.reset();
      console.log(`[CIRCUIT_BREAKER] 🔄 ${provider} circuit breaker reset`);
    }
  }

  /**
   * Reset all circuit breakers
   */
  resetAllBreakers() {
    for (const [provider, breaker] of this.breakers) {
      breaker.reset();
    }
    console.log(`[CIRCUIT_BREAKER] 🔄 All circuit breakers reset`);
  }

  /**
   * Update circuit breaker configuration
   * @param {Object} config - New configuration
   */
  updateConfig(config) {
    this.config = { ...this.config, ...config };
    console.log(`[CIRCUIT_BREAKER] ⚙️ Configuration updated:`, this.config);
  }
}

module.exports = CircuitBreakerManager;
