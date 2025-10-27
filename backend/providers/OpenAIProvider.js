// Please write clean, production-grade JavaScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

const BaseProvider = require('./BaseProvider');

/**
 * OpenAI Provider Implementation
 * Handles communication with OpenAI API
 */
class OpenAIProvider extends BaseProvider {
  constructor() {
    const apiKey = process.env.OpenAI_key || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('Missing OpenAI API key. Set environment variable OpenAI_key or OPENAI_API_KEY.');
    }
    super(apiKey, 'https://api.openai.com/v1');
  }

  /**
   * Call OpenAI API
   * @param {Array} messages - Array of message objects
   * @param {Object} options - Request options
   * @returns {Promise<Object>} OpenAI response
   */
  async call(messages, options = {}) {
    const payload = {
      model: options.model || 'gpt-4o-mini',
      messages,
      response_format: { type: 'json_object' },
      temperature: options.temperature || 0.1,
      max_tokens: options.max_tokens || 4000
    };

    // Add optional parameters
    if (options.top_p) payload.top_p = options.top_p;
    if (options.frequency_penalty) payload.frequency_penalty = options.frequency_penalty;
    if (options.presence_penalty) payload.presence_penalty = options.presence_penalty;

    return await this.makeRequest('/chat/completions', payload, {
      timeout: options.timeout || 30000
    });
  }

  /**
   * Get available models for this provider
   * @returns {Array<string>} List of available models
   */
  getAvailableModels() {
    return [
      'gpt-4o-mini',
      'gpt-4o',
      'gpt-4-turbo',
      'gpt-4',
      'gpt-3.5-turbo'
    ];
  }

  /**
   * Get default model
   * @returns {string} Default model name
   */
  getDefaultModel() {
    return 'gpt-4o-mini';
  }

  /**
   * Validate API key format
   * @returns {boolean} True if API key format is valid
   */
  validateApiKey() {
    return super.validateApiKey() && this.apiKey.startsWith('sk-');
  }

  /**
   * Get provider info
   * @returns {Object} Provider information
   */
  getProviderInfo() {
    return {
      name: 'OpenAI',
      version: '1.0.0',
      baseUrl: this.baseUrl,
      models: this.getAvailableModels(),
      defaultModel: this.getDefaultModel()
    };
  }
}

module.exports = OpenAIProvider;
