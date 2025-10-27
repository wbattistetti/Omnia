// Please write clean, production-grade JavaScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

const BaseProvider = require('./BaseProvider');

/**
 * Groq Provider Implementation
 * Handles communication with Groq API
 */
class GroqProvider extends BaseProvider {
  constructor(apiKey) {
    if (!apiKey) {
      throw new Error('Missing Groq API key.');
    }
    super(apiKey, 'https://api.groq.com/openai/v1');
  }

  /**
   * Call Groq API
   * @param {Array} messages - Array of message objects
   * @param {Object} options - Request options
   * @returns {Promise<Object>} Groq response
   */
  async call(messages, options = {}) {
    const payload = {
      model: options.model || 'llama-3.1-8b-instant',
      messages,
      response_format: { type: 'json_object' },
      temperature: options.temperature,
      max_tokens: options.maxTokens
    };

    // Add optional parameters
    if (options.top_p) payload.top_p = options.top_p;
    if (options.frequency_penalty) payload.frequency_penalty = options.frequency_penalty;
    if (options.presence_penalty) payload.presence_penalty = options.presence_penalty;

    return await this.makeRequest('/chat/completions', payload, options);
  }

  /**
   * Get available models for this provider
   * @returns {Array<string>} List of available models
   */
  getAvailableModels() {
    return [
      'llama-3.1-8b-instant',
      'llama3-70b-8192',
      'mixtral-8x7b-32768',
      'gemma-7b-it'
    ];
  }

  /**
   * Get default model
   * @returns {string} Default model name
   */
  getDefaultModel() {
    return 'llama-3.1-8b-instant';
  }

  /**
   * Validate API key format
   * @returns {boolean} True if API key format is valid
   */
  validateApiKey() {
    return super.validateApiKey() && this.apiKey.startsWith('gsk_');
  }

  /**
   * Get provider info
   * @returns {Object} Provider information
   */
  getProviderInfo() {
    return {
      name: 'Groq',
      version: '1.0.0',
      baseUrl: this.baseUrl,
      models: this.getAvailableModels(),
      defaultModel: this.getDefaultModel()
    };
  }
}

module.exports = GroqProvider;
