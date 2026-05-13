// Please write clean, production-grade JavaScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

const OpenAIProvider = require('../providers/OpenAIProvider');
const GroqProvider = require('../providers/GroqProvider');
const AIConfig = require('../config/AIConfig');
const MetricsCollector = require('./MetricsCollector');
const { computeCallCost } = require('./aiCost/AICostCalculator');
const { appendCall } = require('./aiCost/AICallLogService');

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

      /**
       * Fail-loud sul `purpose`. Tutte le chiamate produttive devono dichiarare uno scopo
       * (label dell'azione: `USE_CASE_BUNDLE_INITIAL`, `AGENT_CREATE`, `INTENT_TRAINING_PHRASES`,
       * ecc.) — \u00e8 quello che il report storico usa come categoria. Un fallback silenzioso
       * "Chiamata IA non categorizzata" mascherava bug a monte e rendeva inutilizzabile il
       * report. L'unica eccezione \u00e8 `internal: true` (health-check, self-test).
       */
      const isInternal = options.internal === true;
      if (!isInternal) {
        const purposeRaw = typeof options.purpose === 'string' ? options.purpose.trim() : '';
        if (!purposeRaw) {
          const err = new Error(
            `AI call is missing the mandatory "purpose" tag. Every callAI() invocation must ` +
              `declare its scope (e.g. USE_CASE_BUNDLE_INITIAL, AGENT_CREATE, INTENT_TRAINING_PHRASES). ` +
              `Provider="${provider}", model="${options.model || '(unset)'}". This is a coding bug, ` +
              `not a runtime failure: add { purpose, taskId?, taskLabel? } to the call site.`
          );
          err.code = 'AI_PURPOSE_REQUIRED';
          err.statusCode = 500;
          throw err;
        }
      }

      // Get provider configuration
      const providerConfig = await this.config.getProviderConfig(provider);
      // Optional opt-in default model from env (`OPENAI_MODEL` / `GROQ_MODEL`); null when not set.
      const optInDefaultModel = await this.config.getDefaultModel(provider);
      // Merge options: spread options first, then apply defaults only for missing values
      const mergedOptions = {
        timeout: options.timeout || providerConfig.timeout,
        temperature: options.temperature || providerConfig.temperature,
        maxTokens: options.maxTokens || providerConfig.maxTokens,
        ...options, // Spread options to preserve all explicitly passed values (including model if provided)
      };
      // Use opt-in env default ONLY if caller didn't pass a model. Never assume a hardcoded model.
      const callerModel =
        typeof mergedOptions.model === 'string' && mergedOptions.model.trim()
          ? mergedOptions.model.trim()
          : null;
      mergedOptions.model = callerModel || optInDefaultModel;

      /**
       * Single source of truth for the AI model: the value comes from the designer's
       * Omnia Tutor selection (`localStorage('omnia.aiModel')`) and is propagated end-to-end.
       * If both the caller and the env opt-in are missing, fail-loud — the UI will route
       * the designer to Settings -> Omnia Tutor with a banner.
       */
      if (!mergedOptions.model) {
        const err = new Error(
          `AI model not selected for provider "${provider}". ` +
            'Configure one in Settings -> Omnia Tutor (designer LLM) before calling the AI.'
        );
        err.code = 'AI_MODEL_REQUIRED';
        err.statusCode = 400;
        throw err;
      }

      console.log(`[AI_PROVIDER] 🚀 Calling ${provider} with model: ${mergedOptions.model}`);

      const result = await providerInstance.call(messages, mergedOptions);

      const latency = Date.now() - startTime;
      this.metrics.recordSuccess(provider, latency);

      try {
        const costRecord = computeCallCost({
          providerId: provider,
          modelId: mergedOptions.model,
          response: result,
        });
        appendCall({
          providerId: provider,
          modelId: mergedOptions.model,
          purpose: options.purpose,
          inputTokens: costRecord.inputTokens,
          outputTokens: costRecord.outputTokens,
          totalTokens: costRecord.totalTokens,
          costUsd: costRecord.costUsd,
          costEur: costRecord.costEur,
          durationMs: latency,
          pricingFound: costRecord.pricingFound,
          taskId: options.taskId,
          taskLabel: options.taskLabel,
        });
      } catch (logErr) {
        console.warn('[AI_PROVIDER] cost log failed:', logErr.message);
      }

      console.log(`[AI_PROVIDER] ✅ ${provider} call successful (${latency}ms)`);
      return result;

    } catch (error) {
      const latency = Date.now() - startTime;
      this.metrics.recordError(provider, error, latency);

      try {
        appendCall({
          providerId: provider,
          modelId: options.model || null,
          purpose: options.purpose,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          costUsd: 0,
          costEur: null,
          durationMs: latency,
          pricingFound: false,
          error: error.message,
          taskId: options.taskId,
          taskLabel: options.taskLabel,
        });
      } catch (logErr) {
        console.warn('[AI_PROVIDER] cost log (error path) failed:', logErr.message);
      }

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

        await this.callAI(provider, testMessages, { timeout: 5000, internal: true });

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
