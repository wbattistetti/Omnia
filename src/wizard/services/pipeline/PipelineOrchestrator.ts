// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Pipeline Orchestrator
 *
 * Centralizes all pipeline logic in a single module.
 * Handles execution, progress tracking, error management, and completion.
 *
 * This replaces distributed pipeline logic across:
 * - PhaseD_Pipeline
 * - generationService
 * - stepExecutors
 * - pipelineState
 * - usePipelineProgress
 */

import type { SchemaNode } from '../../types/wizard.types';
import type { NodePipelineProgress, NodeGenerationResult } from '../../types/pipeline.types';
import type { IPipelineOrchestrator, PipelineOrchestratorOptions, PipelineExecutionResult } from '../interfaces/IPipelineOrchestrator';
import { getNodesInAIMode } from '../../state/modeState';
import { generateNodeLogic, type GenerationOptions } from '../generationService';
import { createInitialPipelineProgress } from '../../state/pipelineState';

/**
 * Pipeline Orchestrator
 *
 * Centralizes all STEP 1-7 pipeline execution logic.
 * Manages progress, errors, and completion for all nodes.
 * Implements IPipelineOrchestrator interface for type safety.
 */
export class PipelineOrchestrator implements IPipelineOrchestrator {
  private progressMap: Map<string, NodePipelineProgress> = new Map();
  private results: Map<string, NodeGenerationResult> = new Map();
  private errors: Array<{ nodeId: string; error: string }> = [];
  private options: PipelineOrchestratorOptions;

  constructor(options: PipelineOrchestratorOptions) {
    this.options = options;
  }

  /**
   * Execute pipeline for all nodes in AI mode.
   *
   * @returns Promise with execution results
   */
  async execute(): Promise<PipelineExecutionResult> {
    const { structure } = this.options;
    const aiNodes = getNodesInAIMode(structure);

    // Reset state
    this.progressMap.clear();
    this.results.clear();
    this.errors = [];

    if (aiNodes.length === 0) {
      // No AI nodes - return empty result
      this.options.onComplete?.();
      return {
        success: true,
        results: this.results,
        progressMap: this.progressMap,
        errors: []
      };
    }

    // Execute pipeline for all AI nodes in parallel
    const promises = aiNodes.map(node => this.executeForNode(node));

    await Promise.all(promises);

    // Check if all succeeded
    const allSucceeded = this.errors.length === 0 &&
      Array.from(this.results.values()).every(r => r.success !== false);

    if (allSucceeded) {
      this.options.onComplete?.();
    }

    return {
      success: allSucceeded,
      results: this.results,
      progressMap: this.progressMap,
      errors: this.errors
    };
  }

  /**
   * Execute pipeline for a single node.
   *
   * @param node - Node to process
   */
  private async executeForNode(node: SchemaNode): Promise<void> {
    const nodeId = node.id || 'unknown';
    const nodeLabel = node.label;

    try {
      // Create initial contract for the node
      const contract = this.createContractForNode(node);

      // Initialize progress
      const initialProgress = createInitialPipelineProgress(nodeId, nodeLabel);
      this.progressMap.set(nodeId, initialProgress);
      this.options.onProgressUpdate?.(nodeId, initialProgress);

      // Execute generation
      const result = await generateNodeLogic({
        nodeId,
        nodeLabel,
        contract,
        mode: 'ai',
        includeChildren: true,
        onProgress: (progress) => {
          this.progressMap.set(nodeId, progress);
          this.options.onProgressUpdate?.(nodeId, progress);
        }
      });

      // Store result
      this.results.set(nodeId, result);
      this.options.onNodeResult?.(nodeId, result);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.errors.push({ nodeId, error: errorMessage });
      this.options.onError?.(nodeId, errorMessage);
    }
  }

  /**
   * Create a basic contract for a node.
   *
   * @param node - Node to create contract for
   * @returns Basic semantic contract
   */
  private createContractForNode(node: SchemaNode): any {
    const subData = node.subData || [];
    const subTasks = node.subTasks || [];
    const hasSubNodes = (subTasks.length > 0 ? subTasks : subData).length > 0;

    return {
      entity: {
        label: node.label,
        type: node.type || 'string',
        description: `Entity: ${node.label}`
      },
      outputCanonical: {
        format: hasSubNodes ? 'object' as const : 'value' as const
      }
    };
  }

  /**
   * Get current progress map.
   */
  getProgressMap(): Map<string, NodePipelineProgress> {
    return new Map(this.progressMap);
  }

  /**
   * Get current results map.
   */
  getResults(): Map<string, NodeGenerationResult> {
    return new Map(this.results);
  }

  /**
   * Get current errors.
   */
  getErrors(): Array<{ nodeId: string; error: string }> {
    return [...this.errors];
  }
}
