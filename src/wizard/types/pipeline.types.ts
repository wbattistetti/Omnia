// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Pipeline Types
 *
 * Defines types related to the STEP 1-7 pipeline execution.
 */

export type PipelineStep =
  | 'contract-refinement'
  | 'canonical-values'
  | 'constraints'
  | 'engines'
  | 'escalation'
  | 'test-examples'
  | 'ai-messages';

export type StepStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'manual'
  | 'error'
  | 'skipped';

export interface StepProgress {
  step: PipelineStep;
  status: StepStatus;
  message?: string;
  timestamp?: Date;
  error?: string;
  percentage?: number; // 0-100 for this step
}

export interface NodePipelineProgress {
  nodeId: string;
  nodeLabel: string;
  steps: Record<PipelineStep, StepProgress>;
  currentStep?: PipelineStep;
  currentAction?: string;
  percentage: number; // 0-100 overall
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

export interface NodeGenerationResult {
  nodeId: string;
  success: boolean;
  contract?: any; // SemanticContract
  engines?: any[]; // EngineConfig[]
  escalation?: any; // EngineEscalation
  testExamples?: string[];
  aiMessages?: any; // AIMessages
  errors?: string[];
}

export interface PipelineConfig {
  nodeId: string;
  mode: 'ai' | 'manual';
  includeChildren?: boolean; // For propagation
}
