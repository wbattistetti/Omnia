// Please write clean, production-grade JavaScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Template Analysis Configuration
 * Centralized configuration for template intelligence system
 *
 * Responsibilities:
 * - Provider/model validation
 * - Configuration constants
 * - Error message enhancement
 */
class TemplateAnalysisConfig {
  constructor() {
    // Number of candidate templates to retrieve via embeddings
    this.topK = 5;

    // Minimum similarity threshold for candidate selection (initial filter)
    this.minSimilarity = 0.3;

    // Quality threshold: if top candidate similarity is below this, return no candidates
    // This prevents passing irrelevant candidates that confuse the AI
    this.qualityThreshold = 0.4;

    // Provider-specific model configurations
    this.providerModels = {
      groq: {
        default: 'llama-3.1-8b-instant',
        valid: [
          'llama-3.1-8b-instant',
          'llama3-70b-8192',
          'mixtral-8x7b-32768',
          'gemma-7b-it'
        ]
      },
      openai: {
        default: 'gpt-4o-mini',
        valid: [
          'gpt-4o-mini',
          'gpt-4-turbo-preview',
          'gpt-4'
        ]
      }
    };
  }

  /**
   * Get valid model for provider with fallback
   * @param {string} provider - AI provider name
   * @param {string|null} requestedModel - Requested model name
   * @returns {string} Valid model name
   */
  getValidModel(provider, requestedModel) {
    const config = this.providerModels[provider];

    if (!config) {
      // Unknown provider, return requested or default
      return requestedModel || 'gpt-4o-mini';
    }

    // If requested model is valid, use it
    if (requestedModel && config.valid.includes(requestedModel)) {
      return requestedModel;
    }

    // Otherwise use default
    return config.default;
  }

  /**
   * Check if model is valid for provider
   * @param {string} provider - AI provider name
   * @param {string} model - Model name
   * @returns {boolean} True if model is valid
   */
  isValidModel(provider, model) {
    if (!model) return false;

    const config = this.providerModels[provider];
    if (!config) return true; // Unknown provider, assume valid

    return config.valid.includes(model);
  }

  /**
   * Enhance error message with context
   * @param {Error} error - Original error
   * @returns {Error} Enhanced error
   */
  enhanceError(error) {
    let message = error.message || 'Unknown error';

    if (message.includes('model_not_found')) {
      message = `Model not found or not accessible. Please use a valid model. Original: ${message}`;
    } else if (message.includes('model_decommissioned')) {
      message = `Model has been decommissioned. Please use a valid model. Original: ${message}`;
    } else if (message.includes('API error') || message.includes('rate limit')) {
      message = `AI provider API error: ${message}. Please check your API key and provider configuration.`;
    }

    const enhanced = new Error(`AI analysis failed: ${message}`);
    enhanced.originalError = error;
    return enhanced;
  }
}

module.exports = TemplateAnalysisConfig;
