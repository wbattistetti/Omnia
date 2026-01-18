// Please write clean, production-grade JavaScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Template Response Parser
 * Isolated responsibility: Parse and validate AI response
 *
 * Responsibilities:
 * - Parse JSON response from AI
 * - Validate response structure
 * - Normalize response format
 */
class TemplateResponseParser {
  /**
   * Parse AI response
   * @param {string} rawResponse - Raw response from AI
   * @returns {Object} Parsed and validated response
   * @throws {Error} If response is invalid
   */
  parseResponse(rawResponse) {
    try {
      let jsonText = rawResponse.trim();

      // Remove markdown code blocks if present
      if (jsonText.startsWith('```')) {
        const match = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (match) {
          jsonText = match[1].trim();
        }
      }

      const parsed = JSON.parse(jsonText);

      // Validate required fields
      this._validateResponse(parsed);

      // Normalize response
      return this._normalizeResponse(parsed);

    } catch (error) {
      throw new Error(
        `Failed to parse AI response: ${error.message}. ` +
        `Raw response preview: ${rawResponse.substring(0, 200)}`
      );
    }
  }

  /**
   * Validate response structure
   * @param {Object} response - Parsed response
   * @throws {Error} If response is invalid
   */
  _validateResponse(response) {
    if (!response.action) {
      throw new Error('Response missing "action" field');
    }

    const validActions = ['use_existing', 'create_new', 'compose'];
    if (!validActions.includes(response.action)) {
      throw new Error(
        `Invalid action: ${response.action}. ` +
        `Must be one of: ${validActions.join(', ')}`
      );
    }

    if (!response.mains || !Array.isArray(response.mains)) {
      throw new Error('Response missing "mains" array');
    }

    if (response.action === 'use_existing' && !response.template_source) {
      throw new Error(
        'Response with action "use_existing" missing "template_source"'
      );
    }
  }

  /**
   * Normalize response format
   * @param {Object} response - Parsed response
   * @returns {Object} Normalized response
   */
  _normalizeResponse(response) {
    return {
      action: response.action,
      template_source: response.template_source || null,
      composed_from: response.composed_from || [],
      auditing_state: response.auditing_state || 'AI_generated',
      reason: response.reason || 'No reason provided',
      label: response.label || 'Data',
      type: response.type || 'generic',
      icon: response.icon || 'FileText',
      mains: response.mains.map(main => this._normalizeMain(main))
    };
  }

  /**
   * Normalize main data structure
   * @param {Object} main - Main data object
   * @returns {Object} Normalized main data
   */
  _normalizeMain(main) {
    return {
      label: main.label || 'Field',
      type: main.type || 'text',
      icon: main.icon || 'FileText',
      subData: Array.isArray(main.subData)
        ? main.subData.map(sub => this._normalizeSubData(sub))
        : [],
      validation: main.validation || {
        description: 'No validation rules provided',
        examples: {
          valid: [],
          invalid: [],
          edgeCases: []
        }
      },
      example: main.example || ''
    };
  }

  /**
   * Normalize subData structure
   * @param {Object} sub - SubData object
   * @returns {Object} Normalized subData
   */
  _normalizeSubData(sub) {
    return {
      label: sub.label || 'Sub-field',
      type: sub.type || 'text',
      icon: sub.icon || 'FileText',
      subData: Array.isArray(sub.subData) ? sub.subData : [],
      validation: sub.validation || {
        description: 'No validation rules provided',
        examples: {
          valid: [],
          invalid: [],
          edgeCases: []
        }
      },
      example: sub.example || ''
    };
  }
}

module.exports = TemplateResponseParser;
