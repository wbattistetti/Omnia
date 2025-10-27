// Please write clean, production-grade JavaScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Base Provider Class for AI Services
 * Provides common functionality for all AI providers
 */
class BaseProvider {
  constructor(apiKey, baseUrl) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  /**
   * Abstract method - must be implemented by subclasses
   * @param {Array} messages - Array of message objects
   * @param {Object} options - Provider-specific options
   * @returns {Promise<Object>} AI response
   */
  async call(messages, options = {}) {
    throw new Error('call() method must be implemented by subclass');
  }

  /**
   * Make HTTP request to AI provider
   * @param {string} endpoint - API endpoint
   * @param {Object} payload - Request payload
   * @param {Object} options - Request options
   * @returns {Promise<Object>} Response data
   */
  async makeRequest(endpoint, payload, options = {}) {
    const controller = new AbortController();
    const timeout = options.timeout || 60000; // Solo fallback di sicurezza
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`${this.constructor.name} API error ${response.status}: ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error(`${this.constructor.name} request timeout after ${timeout}ms`);
      }
      throw error;
    }
  }

  /**
   * Validate API key
   * @returns {boolean} True if API key is valid
   */
  validateApiKey() {
    return this.apiKey && this.apiKey.length > 0;
  }

  /**
   * Get provider name
   * @returns {string} Provider name
   */
  getProviderName() {
    return this.constructor.name.replace('Provider', '').toLowerCase();
  }
}

module.exports = BaseProvider;
