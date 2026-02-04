// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Wizard Types
 *
 * Defines all types related to the card-based wizard system.
 */

export type WizardPhase =
  | 'template-search'
  | 'structure-proposal'
  | 'iteration'
  | 'mode-selection'
  | 'pipeline'
  | 'complete';

export type NodeMode = 'ai' | 'manual' | 'postponed';

export type NodeState =
  | 'proposed'
  | 'approved'
  | 'ai-processing'
  | 'ai-completed'
  | 'manual-editing'
  | 'manual-completed'
  | 'postponed'
  | 'error';

export interface WizardState {
  phase: WizardPhase;
  structure: SchemaNode[];
  rootLabel: string;
  templateFound: boolean;
  templateMatch?: any;
  iterationFeedback?: string;
  iterationCount: number;
  pipelineProgress: Map<string, NodePipelineProgress>;
  generatedArtifacts: Map<string, NodeGenerationResult>;
}

// Import from node.types to avoid duplication
import type { SchemaNode, Constraint } from './node.types';
export type { SchemaNode, Constraint };

// Re-export from shared types
export type { SemanticContract, EngineConfig, EngineEscalation, AIMessages } from '../../../shared/types/contract.types';
export type { PipelineStep, StepStatus, NodePipelineProgress, NodeGenerationResult } from '../../../shared/types/pipeline.types';
