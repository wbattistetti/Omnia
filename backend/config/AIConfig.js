// Please write clean, production-grade JavaScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

const WindowsRegistryHelper = require('../utils/WindowsRegistryHelper');

/**
 * AI Configuration Manager
 * Centralizes all AI provider configurations with Windows Registry fallback
 */
class AIConfig {
  constructor() {
    this.registryHelper = new WindowsRegistryHelper();
    this.config = null;
    this.initialized = false;
  }

  async initializeConfig() {
    if (this.initialized) return;

    // Get API keys with Registry fallback
    const openaiKey = await this.registryHelper.getApiKey([
      'OpenAI_key', 'OPENAI_KEY', 'openai_key',
      'OPENAI_API_KEY', 'OPENAI_api_key', 'openai_api_key',
      'OPENAI_APIKEY', 'OpenAIApiKey'
    ]);

    const groqKey = await this.registryHelper.getApiKey([
      'Groq_key', 'GROQ_KEY', 'groq_key',
      'GROQ_API_KEY', 'GROQ_api_key', 'groq_api_key',
      'GROQ_APIKEY', 'GroqApiKey'
    ]);

    // Debug environment variables
    console.log('[AICONFIG] Environment check:', {
      OpenAI_key: openaiKey ? `Set (${openaiKey.length} chars)` : 'Not set',
      Groq_key: groqKey ? `Set (${groqKey.length} chars)` : 'Not set',
      NODE_ENV: process.env.NODE_ENV || 'undefined'
    });

    this.config = {
      providers: {
        openai: {
          enabled: process.env.OPENAI_ENABLED !== 'false',
          apiKey: openaiKey,
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          timeout: parseInt(process.env.OPENAI_TIMEOUT) || 60000,
          maxRetries: parseInt(process.env.OPENAI_MAX_RETRIES) || 3,
          temperature: parseFloat(process.env.OPENAI_TEMPERATURE) || 0.1,
          maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS) || 4000,
          baseUrl: 'https://api.openai.com/v1'
        },
        groq: {
          enabled: process.env.GROQ_ENABLED !== 'false',
          apiKey: groqKey,
          model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
          timeout: parseInt(process.env.GROQ_TIMEOUT) || 60000,
          maxRetries: parseInt(process.env.GROQ_MAX_RETRIES) || 3,
          temperature: parseFloat(process.env.GROQ_TEMPERATURE) || 0.1,
          maxTokens: parseInt(process.env.GROQ_MAX_TOKENS) || 4000,
          baseUrl: 'https://api.groq.com/openai/v1'
        }
      },
      fallback: {
        enabled: process.env.AI_FALLBACK_ENABLED === 'true',
        strategy: process.env.AI_FALLBACK_STRATEGY || 'local'
      },
      circuitBreaker: {
        timeout: parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT) || 60000,
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

    this.initialized = true;
  }

  /**
   * Get configuration for specific provider
   * @param {string} provider - Provider name
   * @returns {Object} Provider configuration
   */
  async getProviderConfig(provider) {
    await this.initializeConfig();
    return this.config.providers[provider];
  }

  /**
   * Check if provider is enabled
   * @param {string} provider - Provider name
   * @returns {boolean} True if provider is enabled
   */
  async isProviderEnabled(provider) {
    await this.initializeConfig();
    const config = this.config.providers[provider];
    return config && config.enabled && config.apiKey;
  }

  /**
   * Get all enabled providers
   * @returns {Array<string>} List of enabled provider names
   */
  async getEnabledProviders() {
    await this.initializeConfig();
    return Object.keys(this.config.providers).filter(provider =>
      this.config.providers[provider].enabled && this.config.providers[provider].apiKey
    );
  }

  /**
   * Get fallback configuration
   * @returns {Object} Fallback configuration
   */
  async getFallbackConfig() {
    await this.initializeConfig();
    return this.config.fallback;
  }

  /**
   * Get circuit breaker configuration
   * @returns {Object} Circuit breaker configuration
   */
  async getCircuitBreakerConfig() {
    await this.initializeConfig();
    return this.config.circuitBreaker;
  }

  /**
   * Get rate limit configuration for provider
   * @param {string} provider - Provider name
   * @returns {Object} Rate limit configuration
   */
  async getRateLimitConfig(provider) {
    await this.initializeConfig();
    return this.config.rateLimit[provider] || { requests: 100, window: 60000 };
  }

  /**
   * Get default model for provider
   * @param {string} provider - Provider name
   * @returns {string} Default model name
   */
  async getDefaultModel(provider) {
    await this.initializeConfig();
    const config = this.config.providers[provider];
    return config ? config.model : 'gpt-4o-mini';
  }
}

module.exports = AIConfig;
