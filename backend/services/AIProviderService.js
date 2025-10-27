// Please write clean, production-grade JavaScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

const OpenAIProvider = require('../providers/OpenAIProvider');
const GroqProvider = require('../providers/GroqProvider');
const AIConfig = require('../config/AIConfig');
const MetricsCollector = require('./MetricsCollector');

/**
 * AI Provider Service - Enterprise Orchestrator
 * Manages multiple AI providers with enterprise features
 */
class AIProviderService {
  constructor() {
    this.providers = {};
    this.config = new AIConfig();
    this.metrics = new MetricsCollector();
    this.initialized = false;
    this.initializeProviders();
  }

  /**
   * Initialize all available providers
   */
  async initializeProviders() {
    // Initialize OpenAI Provider
    try {
      const openaiConfig = await this.config.getProviderConfig('openai');
      if (openaiConfig && openaiConfig.apiKey) {
        this.providers.openai = new OpenAIProvider(openaiConfig.apiKey);
        console.log('[AI_PROVIDER] ✅ OpenAI provider initialized');
      }
    } catch (error) {
      console.warn('[AI_PROVIDER] ❌ OpenAI provider not available:', error.message);
    }

    // Initialize Groq Provider
    try {
      const groqConfig = await this.config.getProviderConfig('groq');
      if (groqConfig && groqConfig.apiKey) {
        this.providers.groq = new GroqProvider(groqConfig.apiKey);
        console.log('[AI_PROVIDER] ✅ Groq provider initialized');
      } else {
        console.log('[AI_PROVIDER] ⚠️ Groq provider disabled in config');
      }
    } catch (error) {
      console.error('[AI_PROVIDER] ❌ Groq provider initialization failed:', error.message);
      console.error('[AI_PROVIDER] ❌ Groq error details:', error);
    }

    console.log(`[AI_PROVIDER] 🚀 Initialized ${Object.keys(this.providers).length} providers`);
    this.initialized = true;
  }

  /**
   * Call AI provider with enterprise features
   * @param {string} provider - Provider name
   * @param {Array} messages - Message array
   * @param {Object} options - Request options
   * @returns {Promise<Object>} AI response
   */
  async callAI(provider, messages, options = {}) {
    const startTime = Date.now();

    try {
      // Wait for initialization
      if (!this.initialized) {
        await this.initializeProviders();
      }

      // Validate provider
      const providerInstance = this.providers[provider];
      if (!providerInstance) {
        throw new Error(`Unsupported AI provider: ${provider}. Available: ${Object.keys(this.providers).join(', ')}`);
      }

      // Get provider configuration
      const providerConfig = await this.config.getProviderConfig(provider);
      const mergedOptions = {
        model: options.model || await this.config.getDefaultModel(provider),
        timeout: options.timeout || providerConfig.timeout,
        temperature: options.temperature || providerConfig.temperature,
        maxTokens: options.maxTokens || providerConfig.maxTokens,
        ...options
      };

      console.log(`[AI_PROVIDER] 🚀 Calling ${provider} with model: ${mergedOptions.model}`);

      // Make the call
      const result = await providerInstance.call(messages, mergedOptions);

      // Record success metrics
      const latency = Date.now() - startTime;
      this.metrics.recordSuccess(provider, latency);

      console.log(`[AI_PROVIDER] ✅ ${provider} call successful (${latency}ms)`);
      return result;

    } catch (error) {
      const latency = Date.now() - startTime;
      this.metrics.recordError(provider, error, latency);

      console.error(`[AI_PROVIDER] ❌ ${provider} call failed:`, error.message);
      throw error;
    }
  }

  /**
   * Get available providers
   * @returns {Array<string>} List of available provider names
   */
  getAvailableProviders() {
    return Object.keys(this.providers);
  }

  /**
   * Get provider information
   * @param {string} provider - Provider name
   * @returns {Object} Provider information
   */
  getProviderInfo(provider) {
    const providerInstance = this.providers[provider];
    if (!providerInstance) {
      return null;
    }
    return providerInstance.getProviderInfo();
  }

  /**
   * Get all providers information
   * @returns {Object} All providers information
   */
  getAllProvidersInfo() {
    const info = {};
    for (const provider of this.getAvailableProviders()) {
      info[provider] = this.getProviderInfo(provider);
    }
    return info;
  }

  /**
   * Get metrics
   * @returns {Object} Complete metrics
   */
  getMetrics() {
    return this.metrics.getMetrics();
  }

  /**
   * Get metrics for specific provider
   * @param {string} provider - Provider name
   * @returns {Object} Provider metrics
   */
  getProviderMetrics(provider) {
    return this.metrics.getProviderMetrics(provider);
  }

  /**
   * Get success rate for provider
   * @param {string} provider - Provider name
   * @returns {number} Success rate (0-1)
   */
  getProviderSuccessRate(provider) {
    return this.metrics.getSuccessRate(provider);
  }

  /**
   * Health check for all providers
   * @returns {Object} Health status
   */
  async healthCheck() {
    const health = {
      status: 'healthy',
      providers: {},
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    };

    for (const provider of this.getAvailableProviders()) {
      try {
        const testMessages = [{ role: 'user', content: 'health check' }];
        const startTime = Date.now();

        await this.callAI(provider, testMessages, { timeout: 5000 });

        health.providers[provider] = {
          status: 'healthy',
          latency: Date.now() - startTime
        };
      } catch (error) {
        health.providers[provider] = {
          status: 'unhealthy',
          error: error.message
        };
        health.status = 'degraded';
      }
    }

    return health;
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics.reset();
  }

  /**
   * Get service status
   * @returns {Object} Service status
   */
  getStatus() {
    return {
      providers: this.getAvailableProviders(),
      metrics: this.getMetrics(),
      config: {
        enabledProviders: this.config.getEnabledProviders(),
        fallback: this.config.getFallbackConfig()
      },
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = AIProviderService;
