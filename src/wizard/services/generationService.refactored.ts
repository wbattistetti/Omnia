// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Generation Service (Refactored)
 *
 * Orchestrates the STEP 1-7 pipeline using individual step executors.
 * Reduced complexity from 221 lines to ~80 lines.
 * Complexity reduced from 25 to ~5.
 */

import type { NodePipelineProgress, NodeGenerationResult } from '../types/pipeline.types';
import { createInitialPipelineProgress, updateStepStatus, updateOverallPercentage } from '../state/pipelineState';
import {
  executeStep1_ContractRefinement,
  executeStep2_CanonicalValues,
  executeStep3_Constraints,
  executeStep4_Engines,
  executeStep5_Escalation,
  executeStep6_TestExamples,
  executeStep7_AIMessages,
  type StepContext
} from './pipeline/stepExecutors';

export interface GenerationOptions {
  nodeId: string;
  nodeLabel: string;
  contract: any; // SemanticContract
  mode: 'ai' | 'manual';
  includeChildren?: boolean;
  onProgress?: (progress: NodePipelineProgress) => void;
}

/**
 * Generate logic for a single node using the STEP 1-7 pipeline.
 *
 * @param options - Generation options
 * @returns Generation result with contract, engines, test examples, and AI messages
 */
export async function generateNodeLogic(
  options: GenerationOptions
): Promise<NodeGenerationResult> {
  const { nodeId, nodeLabel, contract, mode, onProgress } = options;

  // Manual mode: return empty result
  if (mode === 'manual') {
    return {
      nodeId,
      success: true
    };
  }

  // Initialize progress
  let progress = createInitialPipelineProgress(nodeId, nodeLabel);
  onProgress?.(progress);

  // Create step context
  const context: StepContext = {
    nodeId,
    nodeLabel,
    contract,
    progress,
    onProgress
  };

  try {
    // Execute pipeline steps sequentially
    const step1Result = await executeStep1_ContractRefinement(context);
    context.contract = step1Result.contract;
    context.progress = progress; // Update context with latest progress

    const step2Result = await executeStep2_CanonicalValues(context, step1Result.contract);
    context.contract = step2Result.contract;
    context.progress = progress;

    const step3Result = await executeStep3_Constraints(context, step2Result.contract);
    context.contract = step3Result.contract;
    context.progress = progress;

    const step4Result = await executeStep4_Engines(context, step3Result.contract);
    context.contract = step4Result.contract;
    context.progress = progress;

    const step5Result = await executeStep5_Escalation(context, step4Result.contract, step4Result.engines);
    context.progress = progress;

    const step6Result = await executeStep6_TestExamples(context, step4Result.contract);
    context.progress = progress;

    const step7Result = await executeStep7_AIMessages(context, step4Result.contract);
    context.progress = progress;

    // Return complete result
    return {
      nodeId,
      success: true,
      contract: step4Result.contract,
      engines: step4Result.engines,
      escalation: step5Result.escalation,
      testExamples: step6Result.testExamples,
      aiMessages: step7Result.aiMessages
    };

  } catch (error) {
    console.error('[generationService] Error generating node logic:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    progress = updateStepStatus(
      progress,
      progress.currentStep || 'contract-refinement',
      'error',
      undefined,
      errorMessage
    );
    progress = updateOverallPercentage(progress);
    onProgress?.(progress);

    return {
      nodeId,
      success: false,
      errors: [errorMessage]
    };
  }
}
