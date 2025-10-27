// Please write clean, production-grade JavaScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * AI Configuration Manager
 * Centralizes all AI provider configurations
 */
class AIConfig {
  constructor() {
    this.config = {
      providers: {
        openai: {
          enabled: process.env.OPENAI_ENABLED !== 'false',
          apiKey: process.env.OpenAI_key || process.env.OPENAI_API_KEY,
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          timeout: parseInt(process.env.OPENAI_TIMEOUT) || 30000,
          maxRetries: parseInt(process.env.OPENAI_MAX_RETRIES) || 3,
          baseUrl: 'https://api.openai.com/v1'
        },
        groq: {
          enabled: process.env.GROQ_ENABLED !== 'false',
          apiKey: process.env.GROQ_API_KEY,
          model: process.env.GROQ_MODEL || 'llama3-8b-8192',
          timeout: parseInt(process.env.GROQ_TIMEOUT) || 30000,
          maxRetries: parseInt(process.env.GROQ_MAX_RETRIES) || 3,
          baseUrl: 'https://api.groq.com/openai/v1'
        }
      },
      fallback: {
        enabled: process.env.AI_FALLBACK_ENABLED === 'true',
        strategy: process.env.AI_FALLBACK_STRATEGY || 'local'
      },
      circuitBreaker: {
        timeout: parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT) || 30000,
        errorThresholdPercentage: parseInt(process.env.CIRCUIT_BREAKER_ERROR_THRESHOLD) || 50,
        resetTimeout: parseInt(process.env.CIRCUIT_BREAKER_RESET_TIMEOUT) || 60000
      },
      rateLimit: {
        openai: {
          requests: parseInt(process.env.OPENAI_RATE_LIMIT) || 100,
          window: parseInt(process.env.OPENAI_RATE_WINDOW) || 60000
        },
        groq: {
          requests: parseInt(process.env.GROQ_RATE_LIMIT) || 200,
          window: parseInt(process.env.GROQ_RATE_WINDOW) || 60000
        }
      }
    };
  }

  /**
   * Get configuration for specific provider
   * @param {string} provider - Provider name
   * @returns {Object} Provider configuration
   */
  getProviderConfig(provider) {
    return this.config.providers[provider];
  }

  /**
   * Check if provider is enabled
   * @param {string} provider - Provider name
   * @returns {boolean} True if provider is enabled
   */
  isProviderEnabled(provider) {
    const config = this.getProviderConfig(provider);
    return config && config.enabled && config.apiKey;
  }

  /**
   * Get all enabled providers
   * @returns {Array<string>} List of enabled provider names
   */
  getEnabledProviders() {
    return Object.keys(this.config.providers).filter(provider => 
      this.isProviderEnabled(provider)
    );
  }

  /**
   * Get fallback configuration
   * @returns {Object} Fallback configuration
   */
  getFallbackConfig() {
    return this.config.fallback;
  }

  /**
   * Get circuit breaker configuration
   * @returns {Object} Circuit breaker configuration
   */
  getCircuitBreakerConfig() {
    return this.config.circuitBreaker;
  }

  /**
   * Get rate limit configuration for provider
   * @param {string} provider - Provider name
   * @returns {Object} Rate limit configuration
   */
  getRateLimitConfig(provider) {
    return this.config.rateLimit[provider] || { requests: 100, window: 60000 };
  }

  /**
   * Get default model for provider
   * @param {string} provider - Provider name
   * @returns {string} Default model name
   */
  getDefaultModel(provider) {
    const config = this.getProviderConfig(provider);
    return config ? config.model : 'gpt-4o-mini';
  }
}

module.exports = AIConfig;
