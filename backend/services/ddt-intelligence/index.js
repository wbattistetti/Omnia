// Please write clean, production-grade JavaScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * DDT Intelligence Module
 * Public exports for template intelligence system
 *
 * This module provides a clean, modular architecture for template analysis:
 * - TemplateEmbeddingService: Semantic similarity search
 * - TemplatePromptBuilder: Optimized prompt construction
 * - TemplateResponseParser: Response parsing and validation
 * - TemplateIntelligenceOrchestrator: Main orchestrator
 * - TemplateAnalysisConfig: Configuration
 */

const TemplateIntelligenceOrchestrator = require('./TemplateIntelligenceOrchestrator');
const TemplateEmbeddingService = require('./TemplateEmbeddingService');
const TemplatePromptBuilder = require('./TemplatePromptBuilder');
const TemplateResponseParser = require('./TemplateResponseParser');
const TemplateAnalysisConfig = require('./TemplateAnalysisConfig');

module.exports = {
  TemplateIntelligenceOrchestrator,
  TemplateEmbeddingService,
  TemplatePromptBuilder,
  TemplateResponseParser,
  TemplateAnalysisConfig
};
