// Please write clean, production-grade JavaScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Template Intelligence Service - Enterprise AI Analysis
 * Handles AI-powered template analysis with multi-provider support
 */
class TemplateIntelligenceService {
  constructor(aiProviderService) {
    this.aiProvider = aiProviderService;
  }

  /**
   * Analyze user request using AI
   * @param {string} userDesc - User description
   * @param {Object} templates - Available templates
   * @param {string} provider - AI provider to use
   * @returns {Promise<Object>} Analysis result
   */
  async analyzeUserRequest(userDesc, templates, provider = 'groq', model = null) {
    try {
      console.log(`[AI_ANALYSIS] 🚀 Starting AI analysis with ${provider} for: "${userDesc}"`);
      console.log(`[AI_ANALYSIS] 📋 Using model: ${model || 'default (from getModelForProvider)'}`);

      const prompt = this.buildAnalysisPrompt(userDesc, templates);
      const messages = [
        { role: "system", content: "You are an expert data structure analyzer. Always respond with valid JSON." },
        { role: "user", content: prompt + "\n\nPlease respond with valid JSON format." }
      ];

      console.log(`[AI_ANALYSIS] 📝 Prompt length:`, prompt.length, 'characters');
      console.log(`[AI_ANALYSIS] 📋 Available templates:`, Object.keys(templates).length);

      const response = await this.aiProvider.callAI(provider, messages, {
        model: model || this.getModelForProvider(provider)
      });

      console.log(`[AI_ANALYSIS] 🤖 Raw AI response:`, response.choices[0].message.content.substring(0, 200) + '...');

      const analysis = JSON.parse(response.choices[0].message.content);
      console.log(`[AI_ANALYSIS] ✅ ${provider} analysis successful:`, analysis.action);
      console.log(`[AI_ANALYSIS] 📊 Analysis details:`, {
        action: analysis.action,
        label: analysis.label,
        type: analysis.type,
        icon: analysis.icon,
        mainsCount: analysis.mains?.length || 0,
        hasValidation: analysis.mains?.some(m => m.validation) || false,
        hasExamples: analysis.mains?.some(m => m.example) || false
      });

      return analysis;

    } catch (error) {
      console.error(`[AI_ANALYSIS] ❌ Error with ${provider}:`, error.message);
      throw error;
    }
  }

  /**
   * Build analysis prompt for AI
   * @param {string} userDesc - User description
   * @param {Object} templates - Available templates
   * @returns {string} Formatted prompt
   */
  buildAnalysisPrompt(userDesc, templates) {
    return `You are a DDT Template Intelligence System. Your task is to convert natural language requests into structured, reusable templates.

USER REQUEST: "${userDesc}"

AVAILABLE TEMPLATES:
${JSON.stringify(templates, null, 2)}

⚠️ CRITICAL INSTRUCTION - READ THIS FIRST:
The examples below are ONLY illustrations showing the format and structure. They must NOT be used if they are not semantically relevant to the USER REQUEST above.

- Examples are patterns to follow for STRUCTURE, not content to copy blindly
- Always analyze the USER REQUEST semantically and match it to the appropriate structure complexity
- If the user requests "chiedi eta" (ask for age), you MUST create a simple age field (1 level), NOT "Dati Personali" (personal data with 3 levels)
- If the user requests a single field, you MUST return 1 level, NOT 3 levels
- If the user requests multiple unrelated fields, you MUST return multiple 1-level fields, NOT a complex hierarchy

🎯 OBJECTIVE:
Return a complete JSON structure in a single response, including:
- Action type: use_existing | compose | create_new
- Template structure: label, type, icon, mains
- Field-level validation rules with NATURAL LANGUAGE DESCRIPTIONS
- Example values for testing with valid/invalid/edge cases
- Auditing state
- Intelligent hierarchical structure (1-3 levels as needed)

📊 DECISION ALGORITHM:
1. If semantic match ≥ 0.95 → use_existing
2. If semantic match ≥ 0.80 and request implies aggregation → compose
3. If semantic match < 0.80 → create_new

🏗️ HIERARCHICAL STRUCTURE RULES:
Create hierarchical structure ONLY when the request implies logical grouping:

**1 LEVEL** (Single field requests):
- "Chiedi il nome" → Nome (text)
- "Chiedi l'email" → Email (email)
- "Chiedi eta" → Età (number) - Single field, no subData

**2 LEVELS** (Related fields that belong together):
- "Chiedi nome e cognome" → Nominativo { Nome, Cognome }
- "Chiedi data di nascita" → Data di Nascita { Giorno, Mese, Anno }

**3 LEVELS** (Complex data with multiple categories):
- "Chiedi dati personali" → Dati Personali { Nominativo { Nome, Cognome }, Data di Nascita { Giorno, Mese, Anno }, Indirizzo { Tipo Via, Nome Via, Numero Civico } }
  ⚠️ ONLY use this 3-level structure if the user explicitly requests "dati personali" or similar complex aggregations of multiple unrelated data categories.

⚠️ CRITICAL: subData must ALWAYS be an array of objects, NEVER a string!

📏 RESPONSE FORMAT:
{
  "action": "use_existing | compose | create_new",
  "template_source": "<template_name_if_using_existing>",
  "composed_from": ["<template1>", "<template2>", ...],
  "auditing_state": "AI_generated",
  "reason": "Explanation of decision and template logic",
  "label": "<Main label>",
  "type": "<type_name>",
  "icon": "<icon_name>",
  "mains": [
    {
      "label": "<Field label>",
      "type": "<Field type>",
      "icon": "<icon_name>",
      "subData": [
        {
          "label": "<Sub-field label>",
          "type": "<Sub-field type>",
          "icon": "<icon_name>",
          "subData": [],
          "validation": {
            "description": "<NATURAL LANGUAGE DESCRIPTION>",
            "examples": {
              "valid": ["<example1>", "<example2>"],
              "invalid": ["<example1>", "<example2>"],
              "edgeCases": ["<example1>", "<example2>"]
            }
          },
          "example": "<example value>"
        }
      ],
      "validation": {
        "description": "<NATURAL LANGUAGE DESCRIPTION>",
        "examples": {
          "valid": ["<example1>", "<example2>"],
          "invalid": ["<example1>", "<example2>"],
          "edgeCases": ["<example1>", "<example2>"]
        }
      },
      "example": "<example value>"
    }
  ]
}

📋 EXAMPLE FOR "chiedi eta" (single field - SIMPLE):
{
  "action": "create_new",
  "label": "Età",
  "type": "number",
  "icon": "Hash",
  "mains": [
    {
      "label": "Età",
      "type": "number",
      "icon": "Hash",
      "subData": [],
      "validation": {
        "description": "L'età deve essere un numero intero compreso tra 0 e 150",
        "examples": {
          "valid": ["18", "25", "65"],
          "invalid": ["-5", "200", "abc"],
          "edgeCases": ["0", "150"]
        }
      },
      "example": "25"
    }
  ]
}

📋 EXAMPLE FOR "chiedi dati personali" (complex aggregation - ONLY if user requests this):
{
  "action": "create_new",
  "label": "Dati Personali",
  "type": "personalData",
  "icon": "User",
  "mains": [
    {
      "label": "Nominativo",
      "type": "name",
      "icon": "User",
      "subData": [
        {
          "label": "Nome",
          "type": "text",
          "icon": "User",
          "subData": [],
          "validation": {
            "description": "Nome di battesimo della persona",
            "examples": {
              "valid": ["Mario", "Giuseppe", "Anna"],
              "invalid": ["123", "M@rio", ""],
              "edgeCases": ["Jean-Pierre", "O'Connor"]
            }
          },
          "example": "Mario"
        },
        {
          "label": "Cognome",
          "type": "text",
          "icon": "User",
          "subData": [],
          "validation": {
            "description": "Cognome di famiglia della persona",
            "examples": {
              "valid": ["Rossi", "Bianchi", "Verdi"],
              "invalid": ["123", "R@ssi", ""],
              "edgeCases": ["O'Connor", "Van Der Berg"]
            }
          },
          "example": "Rossi"
        }
      ],
      "validation": {
        "description": "Nominativo completo della persona",
        "examples": {
          "valid": ["Mario Rossi", "Giuseppe Bianchi"],
          "invalid": ["Mario", "Rossi", ""],
          "edgeCases": ["Jean-Pierre Dubois", "Maria O'Connor"]
        }
      },
      "example": "Mario Rossi"
    }
  ]
}

⚠️ FINAL REMINDER: Match the structure complexity to the USER REQUEST above, not to the examples! If the request is simple (like "chiedi eta"), return a simple structure. If the request explicitly asks for complex data (like "chiedi dati personali"), then use the complex structure.`;
  }

  /**
   * Get model for provider
   * @param {string} provider - Provider name
   * @returns {string} Model name
   */
  getModelForProvider(provider) {
    const models = {
      openai: 'gpt-4o-mini',
      groq: 'llama-3.1-8b-instant'
    };
    return models[provider] || 'gpt-4o-mini';
  }

  /**
   * Compose templates from existing ones
   * @param {Array} templateNames - Template names to compose
   * @param {Object} templates - Available templates
   * @param {string} userDesc - User description
   * @returns {Promise<Object>} Composed result
   */
  async composeTemplates(templateNames, templates, userDesc) {
    const composedMains = [];

    for (const templateName of templateNames) {
      const template = templates[templateName];
      if (template) {
        // Resolve subData with 3-level support
        const resolvedSubData = await this.resolveTemplateRefs(template.subData || [], templates);

        // Enhance with validation and examples
        const enhancedSubData = resolvedSubData.map(item => ({
          ...item,
          validation: {
            ...item.validation,
            description: this.generateValidationDescription(item.type, item.validation),
            examples: this.generateTestExamples(item.type, item.validation)
          }
        }));

        composedMains.push({
          label: template.label,
          type: template.type,
          icon: template.icon,
          subData: enhancedSubData,
          validation: {
            description: `This field contains ${template.label.toLowerCase()} information`,
            examples: this.generateTestExamples(template.type, template.validation)
          },
          example: this.generateExampleValue(template.type)
        });
      }
    }

    return {
      ai: {
        action: 'compose',
        composed_from: templateNames,
        auditing_state: 'AI_generated',
        reason: `Composed from existing templates: ${templateNames.join(', ')}`,
        label: userDesc.charAt(0).toUpperCase() + userDesc.slice(1),
        type: 'composite',
        icon: 'user',
        schema: {
          label: userDesc.charAt(0).toUpperCase() + userDesc.slice(1),
          mainData: composedMains
        }
      }
    };
  }

  /**
   * Use existing template with enhancements
   * @param {string} templateName - Template name
   * @param {Object} templates - Available templates
   * @param {string} userDesc - User description
   * @returns {Promise<Object>} Enhanced template result
   */
  async useExistingTemplate(templateName, templates, userDesc) {
    const template = templates[templateName];
    if (!template) {
      throw new Error(`Template ${templateName} not found`);
    }

    // Resolve subData with 3-level support
    const resolvedSubData = await this.resolveTemplateRefs(template.subData || [], templates);

    // Enhance with validation and examples
    const enhancedSubData = resolvedSubData.map(item => ({
      ...item,
      validation: {
        ...item.validation,
        description: this.generateValidationDescription(item.type, item.validation),
        examples: this.generateTestExamples(item.type, item.validation)
      }
    }));

    return {
      ai: {
        action: 'use_existing',
        template_source: templateName,
        auditing_state: 'AI_generated',
        reason: `Used existing "${templateName}" template with enhanced validation`,
        label: template.label,
        type: template.type,
        icon: template.icon,
        schema: {
          label: template.label,
          mainData: [{
            label: template.label,
            type: template.type,
            icon: template.icon,
            subData: enhancedSubData,
            validation: {
              description: `This field contains ${template.label.toLowerCase()} information`,
              examples: this.generateTestExamples(template.type, template.validation)
            },
            example: this.generateExampleValue(template.type),
            // Include stepPrompts from matched template
            stepPrompts: template.stepPrompts || null
          }],
          // Include stepPrompts at schema level too
          stepPrompts: template.stepPrompts || null
        }
      }
    };
  }

  /**
   * Resolve template references recursively
   * @param {Array} subData - Sub data array
   * @param {Object} templates - Available templates
   * @param {number} level - Current level
   * @returns {Promise<Array>} Resolved sub data
   */
  async resolveTemplateRefs(subData, templates, level = 0) {
    const resolved = [];

    // Safety limit to avoid infinite recursion
    if (level > 10) {
      console.warn(`[TEMPLATE_RESOLUTION] Max level reached (${level}), stopping recursion`);
      return resolved;
    }

    for (const item of subData) {
      if (item.templateRef && templates[item.templateRef]) {
        // Expand referenced template
        const referencedTemplate = templates[item.templateRef];

        if (referencedTemplate.subData && referencedTemplate.subData.length > 0) {
          // If referenced template has subData, expand recursively
          const expandedSubData = await this.resolveTemplateRefs(referencedTemplate.subData, templates, level + 1);
          resolved.push(...expandedSubData);
        } else {
          // If it's an atomic template, add directly
          resolved.push({
            label: item.label || referencedTemplate.label,
            type: referencedTemplate.type,
            icon: referencedTemplate.icon,
            constraints: referencedTemplate.constraints || [],
            level: level
          });
        }
      } else {
        // If no templateRef, add directly
        resolved.push({
          label: item.label,
          type: item.type,
          icon: item.icon,
          constraints: item.constraints || [],
          level: level
        });
      }
    }

    return resolved;
  }

  /**
   * Generate validation description
   * @param {string} type - Field type
   * @param {Object} validation - Validation rules
   * @returns {string} Description
   */
  generateValidationDescription(type, validation) {
    const descriptions = {
      'name': 'The name must contain only letters, spaces, hyphens and apostrophes. It must be between 2 and 100 characters long.',
      'date': 'The date must be in YYYY-MM-DD format and represent a valid calendar date. The year must be between 1900 and 2024.',
      'email': 'The email must be in valid email format with a domain and local part.',
      'phone': 'The phone number must contain only digits and be between 6 and 15 characters long.',
      'address': 'The address must contain street information, city, and postal code.',
      'generic': 'This field accepts text input with basic validation rules.'
    };

    return descriptions[type] || 'This field has specific validation rules that must be followed.';
  }

  /**
   * Generate test examples
   * @param {string} type - Field type
   * @param {Object} validation - Validation rules
   * @returns {Object} Test examples
   */
  generateTestExamples(type, validation) {
    const examples = {
      'name': {
        valid: ['Mario Rossi', 'Jean-Pierre O\'Connor', 'María José'],
        invalid: ['123', 'M', 'John@Doe'],
        edgeCases: ['A', 'Jean-Pierre', 'O\'Connor']
      },
      'date': {
        valid: ['1990-05-12', '2000-12-31', '1985-01-01'],
        invalid: ['32-13-99', '2024-02-30', '1899-01-01'],
        edgeCases: ['1900-01-01', '2024-12-31', '2000-02-29']
      },
      'email': {
        valid: ['mario.rossi@example.com', 'user+alias@domain.co.uk', 'name@domain.it'],
        invalid: ['plainaddress', '@missinglocal.org', 'user@.com'],
        edgeCases: ['a@b.co', 'very.common@example.com', 'user@[192.168.1.1]']
      },
      'phone': {
        valid: ['+39 333 1234567', '0212345678', '5551234'],
        invalid: ['123', 'abc', '12345'],
        edgeCases: ['+1 555', '1234567890123456', '+39']
      },
      'address': {
        valid: ['Via Roma 10, 20100 Milano, Italia', '123 Main St, New York, NY 10001'],
        invalid: ['', '123', 'Via Roma'],
        edgeCases: ['Via Roma 10', 'Milano, Italia', '123 Main St']
      },
      'generic': {
        valid: ['Sample text', 'Valid input', 'Test value'],
        invalid: ['', '   ', 'a'],
        edgeCases: ['A', 'Very long text that might exceed limits', 'Special chars: !@#$%']
      }
    };

    return examples[type] || examples['generic'];
  }

  /**
   * Generate example value
   * @param {string} type - Field type
   * @returns {string} Example value
   */
  generateExampleValue(type) {
    const examples = {
      'name': 'Mario Rossi',
      'date': '1990-05-12',
      'email': 'mario.rossi@example.com',
      'phone': '+39 333 1234567',
      'address': 'Via Roma 10, 20100 Milano, Italia',
      'generic': 'Sample text'
    };

    return examples[type] || 'Example value';
  }
}

module.exports = TemplateIntelligenceService;
