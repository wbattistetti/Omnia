// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * @deprecated This file is being refactored into modular components.
 * Please use the new modules in src/utils/wizard/ instead.
 * This file maintains backward compatibility by re-exporting from new modules.
 */

// Re-export types and functions from new modular structure
export type { NodeAnalysis, TreeAnalysis } from './wizard/analyzeTree';
export type { EngineProposal } from './wizard/proposeEngines';
export type { GenerationPlan } from './wizard/buildGenerationPlan';
export type { GenerationProgress } from './wizard/types';
export type { NodeGenerationResult } from './wizard/executeGenerationPlan';

export { analyzeTree } from './wizard/analyzeTree';
export { proposeEngines } from './wizard/proposeEngines';
export { buildGenerationPlan } from './wizard/buildGenerationPlan';
export { executeGenerationPlan } from './wizard/executeGenerationPlan';
export { generateContractForNode } from './wizard/generateContract';
export { generateEngineForNode, buildEngineConfigFromAIResponse } from './wizard/generateEngines';
export { generateTestExamplesForNode } from './wizard/generateTestExamples';
