// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Pipeline Orchestrator Interface
 *
 * Defines the contract for pipeline orchestration.
 * Provides semantic boundaries and type safety.
 */

import type { SchemaNode } from '../../types/wizard.types';
import type { NodePipelineProgress, NodeGenerationResult } from '../../types/pipeline.types';

export interface IPipelineOrchestrator {
  /**
   * Execute pipeline for all nodes in AI mode.
   *
   * @returns Promise with execution results
   *
   * @throws Error if execution fails
   */
  execute(): Promise<PipelineExecutionResult>;

  /**
   * Get current progress map.
   *
   * @returns Map of node IDs to progress
   */
  getProgressMap(): Map<string, NodePipelineProgress>;

  /**
   * Get current results map.
   *
   * @returns Map of node IDs to results
   */
  getResults(): Map<string, NodeGenerationResult>;

  /**
   * Get current errors.
   *
   * @returns Array of errors
   */
  getErrors(): Array<{ nodeId: string; error: string }>;
}

export interface PipelineOrchestratorOptions {
  structure: SchemaNode[];
  onProgressUpdate?: (nodeId: string, progress: NodePipelineProgress) => void;
  onNodeResult?: (nodeId: string, result: NodeGenerationResult) => void;
  onComplete?: () => void;
  onError?: (nodeId: string, error: string) => void;
}

export interface PipelineExecutionResult {
  success: boolean;
  results: Map<string, NodeGenerationResult>;
  progressMap: Map<string, NodePipelineProgress>;
  errors: Array<{ nodeId: string; error: string }>;
}
