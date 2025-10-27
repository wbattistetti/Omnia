// Please write clean, production-grade JavaScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

const BaseProvider = require('./BaseProvider');

/**
 * Groq Provider Implementation
 * Handles communication with Groq API
 */
class GroqProvider extends BaseProvider {
  constructor() {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error('Missing Groq API key. Set environment variable GROQ_API_KEY.');
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
      model: options.model || 'llama3-8b-8192',
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
      'llama3-8b-8192',
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
    return 'llama3-8b-8192';
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
