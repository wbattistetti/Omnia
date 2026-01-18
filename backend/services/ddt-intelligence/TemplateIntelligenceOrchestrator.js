// Please write clean, production-grade JavaScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

const TemplateEmbeddingService = require('./TemplateEmbeddingService');
const TemplatePromptBuilder = require('./TemplatePromptBuilder');
const TemplateResponseParser = require('./TemplateResponseParser');
const TemplateAnalysisConfig = require('./TemplateAnalysisConfig');

/**
 * Template Intelligence Orchestrator
 * Main orchestrator that coordinates all components
 *
 * Responsibilities:
 * - Coordinate embedding retrieval
 * - Build prompt with candidates
 * - Call AI provider
 * - Parse and return response
 *
 * Architecture:
 * 1. Retrieval: Find top-K similar templates via embeddings
 * 2. Prompt: Build optimized prompt with only candidates
 * 3. AI Call: Send prompt to AI provider
 * 4. Parse: Parse and validate AI response
 */
class TemplateIntelligenceOrchestrator {
  constructor(aiProviderService) {
    if (!aiProviderService) {
      throw new Error('AIProviderService is required');
    }

    this.aiProvider = aiProviderService;
    this.embeddingService = new TemplateEmbeddingService();
    this.promptBuilder = new TemplatePromptBuilder();
    this.responseParser = new TemplateResponseParser();
    this.config = new TemplateAnalysisConfig();
  }

  /**
   * Initialize orchestrator (pre-compute embeddings)
   * @param {Object} templates - All available templates
   */
  async initialize(templates) {
    try {
      await this.embeddingService.precomputeEmbeddings(templates);
      console.log('[TemplateIntelligenceOrchestrator] Initialized successfully');
    } catch (error) {
      console.warn(
        '[TemplateIntelligenceOrchestrator] Initialization failed (embeddings not available):',
        error.message
      );
      // Continue without embeddings - will fallback to create_new
    }
  }

  /**
   * Analyze user request using AI with embedding-based retrieval
   * @param {string} userDesc - User description
   * @param {Object} templates - All available templates
   * @param {string} provider - AI provider (default: 'groq')
   * @param {string|null} model - Model name (optional)
   * @returns {Promise<Object>} Analysis result
   */
  async analyzeUserRequest(userDesc, templates, provider = 'groq', model = null) {
    const startTime = Date.now();

    try {
      console.log(`[TemplateIntelligence] Starting analysis for: "${userDesc}"`);
      console.log(`[TemplateIntelligence] Provider: ${provider}, Model: ${model || 'default'}`);

      // Validate input
      if (!userDesc || typeof userDesc !== 'string' || userDesc.trim().length === 0) {
        throw new Error('User description is required and must be a non-empty string');
      }

      if (!templates || typeof templates !== 'object') {
        throw new Error('Templates object is required');
      }

      // PHASE 1: Retrieval with embeddings
      let candidateTemplates = [];
      try {
        candidateTemplates = await this.embeddingService.findSimilarTemplates(
          userDesc,
          templates,
          this.config.topK,
          this.config.minSimilarity,
          this.config.qualityThreshold
        );

        console.log(
          `[TemplateIntelligence] Found ${candidateTemplates.length} candidate templates ` +
          `via embeddings`
        );
      } catch (embeddingError) {
        console.warn(
          `[TemplateIntelligence] Embedding retrieval failed: ${embeddingError.message}. ` +
          `Continuing without candidates (will create new template)`
        );
        // Continue with empty candidates - AI will create_new
      }

      // PHASE 2: Build prompt with only candidates
      const messages = this.promptBuilder.buildMessages(userDesc, candidateTemplates);
      const promptLength = messages[1].content.length;
      const fullPromptLength = this._estimateFullPromptLength(templates);

      console.log(
        `[TemplateIntelligence] Prompt length: ${promptLength} characters ` +
        `(vs ${fullPromptLength} with all templates - ${((1 - promptLength / fullPromptLength) * 100).toFixed(1)}% reduction)`
      );

      // PHASE 3: Call AI
      const validModel = this.config.getValidModel(provider, model);

      if (model && model !== validModel) {
        console.warn(
          `[TemplateIntelligence] Invalid model "${model}" for ${provider}, ` +
          `using "${validModel}"`
        );
      }

      console.log(`[TemplateIntelligence] Calling AI with model: ${validModel}`);

      const response = await this.aiProvider.callAI(provider, messages, {
        model: validModel
      });

      const rawResponse = response.choices[0].message.content;
      console.log(
        `[TemplateIntelligence] Raw AI response: ` +
        `${rawResponse.substring(0, 200)}${rawResponse.length > 200 ? '...' : ''}`
      );

      // PHASE 4: Parse response
      const analysis = this.responseParser.parseResponse(rawResponse);

      const elapsed = Date.now() - startTime;
      console.log(
        `[TemplateIntelligence] Analysis successful: ${analysis.action} ` +
        `(${elapsed}ms)`
      );

      // Log analysis details
      this._logAnalysisDetails(analysis);

      return analysis;

    } catch (error) {
      const elapsed = Date.now() - startTime;
      console.error(`[TemplateIntelligence] Error after ${elapsed}ms:`, error);

      throw this.config.enhanceError(error);
    }
  }

  /**
   * Estimate full prompt length (for comparison)
   * @param {Object} templates - All templates
   * @returns {number} Estimated length
   */
  _estimateFullPromptLength(templates) {
    const templatesJson = JSON.stringify(templates);
    return templatesJson.length + 3000; // Base prompt + templates
  }

  /**
   * Log analysis details
   * @param {Object} analysis - Analysis result
   */
  _logAnalysisDetails(analysis) {
    console.log(`[TemplateIntelligence] Analysis details:`, {
      action: analysis.action,
      label: analysis.label,
      type: analysis.type,
      icon: analysis.icon,
      mainsCount: analysis.mains?.length || 0,
      hasValidation: analysis.mains?.some(m => m.validation) || false,
      hasExamples: analysis.mains?.some(m => m.example) || false
    });

    if (analysis.mains && analysis.mains.length > 0) {
      console.log(`[TemplateIntelligence] Detailed mains analysis:`);
      analysis.mains.forEach((main, index) => {
        console.log(`[TemplateIntelligence]   Main ${index + 1}:`, {
          label: main.label,
          type: main.type,
          icon: main.icon,
          hasValidation: !!main.validation,
          hasExamples: !!main.example,
          subDataCount: main.subData?.length || 0,
          validationDescription: main.validation?.description || 'NO DESCRIPTION',
          exampleValue: main.example || 'NO EXAMPLE'
        });
      });
    }
  }
}

module.exports = TemplateIntelligenceOrchestrator;
