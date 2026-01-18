// Please write clean, production-grade JavaScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Template Prompt Builder
 * Isolated responsibility: Build optimized prompts for AI analysis
 *
 * Responsibilities:
 * - Build prompt with only candidate templates (not all templates)
 * - Include clear instructions
 * - Format response structure
 */
class TemplatePromptBuilder {
  constructor(config = {}) {
    this.config = {
      maxCandidateTemplates: config.maxCandidateTemplates || 5,
      includeExamples: config.includeExamples !== false,
      ...config
    };
  }

  /**
   * Build analysis prompt with candidate templates only
   * @param {string} userDesc - User description
   * @param {Array} candidateTemplates - Top-K templates from embedding search
   * @returns {string} Formatted prompt
   */
  buildAnalysisPrompt(userDesc, candidateTemplates = []) {
    const templatesSection = candidateTemplates.length > 0
      ? this._formatCandidateTemplates(candidateTemplates)
      : 'No candidate templates found (will create new template)';

    return `You are a DDT Template Intelligence System. Your task is to convert natural language requests into structured, reusable templates.

USER REQUEST: "${userDesc}"

CANDIDATE TEMPLATES (retrieved via semantic similarity - top ${candidateTemplates.length}):
${templatesSection}

CRITICAL INSTRUCTION:
You have been given ONLY the most semantically similar templates to the user request.
These templates were selected using embeddings (semantic similarity), not exact word matching.

Your task:
1. Analyze if ANY of these candidate templates matches the user request semantically
2. If YES -> use_existing (specify template_source)
3. If NO -> create_new

DECISION RULES:
- If the user request semantically matches one of the candidate templates -> use_existing
- If the user request is similar but needs significant modifications -> create_new
- If none of the candidates match -> create_new
- Semantic match means: same domain, similar fields, compatible structure

HIERARCHICAL STRUCTURE RULES:
Create hierarchical structure ONLY when the request implies logical grouping:

**1 LEVEL** (Single field requests):
- "Chiedi il nome" -> Nome (text)
- "Chiedi l'email" -> Email (email)
- "Chiedi eta" -> Eta (number)

**2 LEVELS** (Related fields that belong together):
- "Chiedi nome e cognome" -> Nominativo { Nome, Cognome }
- "Chiedi data di nascita" -> Data di Nascita { Giorno, Mese, Anno }

**3 LEVELS** (Complex data with multiple categories):
- "Chiedi dati personali" -> Dati Personali { Nominativo { Nome, Cognome }, Data di Nascita { Giorno, Mese, Anno } }
  ONLY use 3-level structure if user explicitly requests complex aggregation

CRITICAL: subData must ALWAYS be an array of objects, NEVER a string!

RESPONSE FORMAT:
{
  "action": "use_existing | create_new",
  "template_source": "<template_id_if_using_existing>",
  "auditing_state": "AI_generated",
  "reason": "Explanation of decision",
  "label": "<Main label>",
  "type": "<type_name>",
  "icon": "<icon_name>",
  "mains": [
    {
      "label": "<Field label>",
      "type": "<Field type>",
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
  ]
}

FINAL REMINDER: Match the structure complexity to the USER REQUEST, not to the examples!
If the request is simple (like "chiedi eta"), return a simple structure.
If the request explicitly asks for complex data (like "chiedi dati personali"), then use the complex structure.`;
  }

  /**
   * Format candidate templates for prompt (only essential fields)
   * @param {Array} candidateTemplates - Candidate templates
   * @returns {string} Formatted templates section
   */
  _formatCandidateTemplates(candidateTemplates) {
    const formatted = candidateTemplates.map((template, index) => {
      const essential = {
        id: template.id || template._id,
        label: template.label,
        type: template.type,
        mainDataCount: template.mainData?.length || 0,
        mainDataLabels: template.mainData?.map(m => m.label) || []
      };
      return `\n--- Candidate ${index + 1} ---\n${JSON.stringify(essential, null, 2)}`;
    }).join('\n');

    return formatted;
  }

  /**
   * Build system message
   * @returns {string} System message
   */
  buildSystemMessage() {
    return "You are an expert data structure analyzer. Always respond with valid JSON.";
  }

  /**
   * Build complete messages array for AI call
   * @param {string} userDesc - User description
   * @param {Array} candidateTemplates - Candidate templates
   * @returns {Array} Messages array for AI provider
   */
  buildMessages(userDesc, candidateTemplates) {
    const prompt = this.buildAnalysisPrompt(userDesc, candidateTemplates);

    return [
      {
        role: "system",
        content: this.buildSystemMessage()
      },
      {
        role: "user",
        content: `${prompt}\n\nPlease respond with valid JSON format.`
      }
    ];
  }
}

module.exports = TemplatePromptBuilder;
