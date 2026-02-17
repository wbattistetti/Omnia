// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Pipeline Step Executors
 *
 * Individual step executors for the STEP 1-7 pipeline.
 * Each step is isolated in its own function to reduce complexity.
 */

import type { NodePipelineProgress, PipelineStep } from '../../types/pipeline.types';
import { updateStepStatus, updateStepPercentage, updateOverallPercentage } from '../../state/pipelineState';

export interface StepContext {
  nodeId: string;
  nodeLabel: string;
  contract: any; // SemanticContract
  progress: NodePipelineProgress;
  onProgress?: (progress: NodePipelineProgress) => void;
}

export interface StepResult {
  contract: any; // SemanticContract
  engines?: any[];
  escalation?: any;
  testExamples?: string[];
  aiMessages?: any;
}

/**
 * Update progress helper
 */
function updateProgress(
  progress: NodePipelineProgress,
  step: PipelineStep,
  status: 'processing' | 'completed' | 'skipped' | 'error',
  message?: string,
  percentage?: number,
  error?: string,
  onProgress?: (progress: NodePipelineProgress) => void
): NodePipelineProgress {
  let updated = updateStepStatus(progress, step, status, message, error);
  if (percentage !== undefined) {
    updated = updateStepPercentage(updated, step, percentage);
  }
  updated = updateOverallPercentage(updated);
  onProgress?.(updated);
  return updated;
}

/**
 * STEP 1: Contract Refinement
 *
 * ⚠️ ARCHITECTURAL RULE: SemanticContract is deterministic and never modified
 * This step is now a no-op - contract is returned unchanged
 */
export async function executeStep1_ContractRefinement(
  context: StepContext
): Promise<{ contract: any }> {
  const { contract, nodeLabel, progress, onProgress } = context;

  // ⚠️ DEPRECATED: refineContract violates architectural rules
  // SemanticContract must be deterministic and never modified by AI
  console.warn('[executeStep1_ContractRefinement] ⚠️ Contract refinement skipped - SemanticContract is deterministic and immutable');

  let updatedProgress = updateProgress(
    progress,
    'contract-refinement',
    'completed',
    'Contract unchanged (deterministic)',
    undefined,
    undefined,
    onProgress
  );

  // Return original contract unchanged
  return { contract };
}

/**
 * STEP 2: Canonical Values
 *
 * ⚠️ ARCHITECTURAL RULE: SemanticContract is deterministic and never modified
 * This step is now a no-op - contract is returned unchanged
 */
export async function executeStep2_CanonicalValues(
  context: StepContext,
  contract: any
): Promise<{ contract: any }> {
  const { nodeLabel, progress, onProgress } = context;

  // ⚠️ DEPRECATED: generateCanonicalValuesForNode violates architectural rules
  // SemanticContract must be deterministic and never modified by AI
  console.warn('[executeStep2_CanonicalValues] ⚠️ Canonical values generation skipped - SemanticContract is deterministic and immutable');

  const updatedProgress = updateProgress(
    progress,
    'canonical-values',
    'completed',
    'Canonical values skipped (deterministic contract)',
    undefined,
    undefined,
    onProgress
  );

  // Return original contract unchanged
  return { contract };
}

/**
 * STEP 3: Constraints
 *
 * ⚠️ ARCHITECTURAL RULE: SemanticContract is deterministic and never modified
 * This step is now a no-op - contract is returned unchanged
 */
export async function executeStep3_Constraints(
  context: StepContext,
  contract: any
): Promise<{ contract: any }> {
  const { nodeLabel, progress, onProgress } = context;

  // ⚠️ DEPRECATED: generateConstraintsForNode violates architectural rules
  // SemanticContract must be deterministic and never modified by AI
  console.warn('[executeStep3_Constraints] ⚠️ Constraints generation skipped - SemanticContract is deterministic and immutable');

  const updatedProgress = updateProgress(
    progress,
    'constraints',
    'completed',
    'Constraints skipped (deterministic contract)',
    undefined,
    undefined,
    onProgress
  );

  // Return original contract unchanged
  return { contract };
}

/**
 * STEP 4: Engines
 */
export async function executeStep4_Engines(
  context: StepContext,
  contract: any
): Promise<{ contract: any; engines?: any[] }> {
  const { nodeLabel, progress, onProgress } = context;

  let updatedProgress = updateProgress(
    progress,
    'engines',
    'processing',
    'Generating engines...',
    undefined,
    undefined,
    onProgress
  );

  const { generateEnginesForNode } = await import('../../../../utils/wizard/generateEnginesUnified');

  const enginesResult = await generateEnginesForNode(contract, nodeLabel, (p) => {
    updatedProgress = updateProgress(
      updatedProgress,
      'engines',
      'processing',
      'Generating engines...',
      p.percentage || 0,
      undefined,
      onProgress
    );
  });

  updateProgress(
    updatedProgress,
    'engines',
    'completed',
    'Engines generated',
    undefined,
    undefined,
    onProgress
  );

  return {
    contract: enginesResult.contract,
    engines: enginesResult.engines
  };
}

/**
 * STEP 5: Escalation
 */
export async function executeStep5_Escalation(
  context: StepContext,
  contract: any,
  engines?: any[]
): Promise<{ escalation?: any }> {
  const { nodeId, nodeLabel, progress, onProgress } = context;

  if (!engines || engines.length === 0) {
    updateProgress(
      progress,
      'escalation',
      'skipped',
      'No engines available',
      undefined,
      undefined,
      onProgress
    );
    return {};
  }

  let updatedProgress = updateProgress(
    progress,
    'escalation',
    'processing',
    'Generating escalation...',
    undefined,
    undefined,
    onProgress
  );

  const { generateEscalationForNode } = await import('../../../../utils/wizard/generateEscalation');

  const escalation = await generateEscalationForNode(
    contract,
    engines,
    nodeId,
    nodeLabel,
    null,
    (p) => {
      updatedProgress = updateProgress(
        updatedProgress,
        'escalation',
        'processing',
        'Generating escalation...',
        p.percentage || 0,
        undefined,
        onProgress
      );
    }
  );

  updateProgress(
    updatedProgress,
    'escalation',
    'completed',
    'Escalation generated',
    undefined,
    undefined,
    onProgress
  );

  return { escalation };
}

/**
 * STEP 6: Test Examples
 */
export async function executeStep6_TestExamples(
  context: StepContext,
  contract: any
): Promise<{ testExamples?: string[] }> {
  const { nodeId, nodeLabel, progress, onProgress } = context;

  let updatedProgress = updateProgress(
    progress,
    'test-examples',
    'processing',
    'Generating test examples...',
    undefined,
    undefined,
    onProgress
  );

  const { generateTestExamplesForNode } = await import('../../../../utils/wizard/generateTestExamples');

  const testExamples = await generateTestExamplesForNode(
    { id: nodeId, label: nodeLabel } as any,
    contract,
    [],
    (p) => {
      updatedProgress = updateProgress(
        updatedProgress,
        'test-examples',
        'processing',
        'Generating test examples...',
        p.percentage || 0,
        undefined,
        onProgress
      );
    }
  );

  updateProgress(
    updatedProgress,
    'test-examples',
    'completed',
    'Test examples generated',
    undefined,
    undefined,
    onProgress
  );

  return { testExamples };
}

/**
 * STEP 7: AI Messages
 */
export async function executeStep7_AIMessages(
  context: StepContext,
  contract: any
): Promise<{ aiMessages?: any }> {
  const { nodeLabel, progress, onProgress } = context;

  let updatedProgress = updateProgress(
    progress,
    'ai-messages',
    'processing',
    'Generating AI messages...',
    undefined,
    undefined,
    onProgress
  );

  const { generateAIMessagesForNode } = await import('../../../../utils/wizard/generateAIMessages');

  const aiMessages = await generateAIMessagesForNode(
    contract,
    nodeLabel,
    null,
    (p) => {
      updatedProgress = updateProgress(
        updatedProgress,
        'ai-messages',
        'processing',
        'Generating AI messages...',
        p.percentage || 0,
        undefined,
        onProgress
      );
    }
  );

  updateProgress(
    updatedProgress,
    'ai-messages',
    'completed',
    'AI messages generated',
    undefined,
    undefined,
    onProgress
  );

  return { aiMessages };
}
