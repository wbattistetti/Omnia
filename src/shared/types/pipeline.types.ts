// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Shared Pipeline Types
 *
 * Types shared between wizard and response-editor modules.
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
  percentage?: number;
}

export interface NodePipelineProgress {
  nodeId: string;
  nodeLabel: string;
  steps: Record<PipelineStep, StepProgress>;
  currentStep?: PipelineStep;
  currentAction?: string;
  percentage: number;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

export interface NodeGenerationResult {
  nodeId: string;
  success: boolean;
  contract?: any;
  engines?: any[];
  escalation?: any;
  testExamples?: string[];
  aiMessages?: any;
  errors?: string[];
}
