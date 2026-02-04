// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Generation Service Interface
 *
 * Defines the contract for node generation services.
 * Provides semantic boundaries and type safety.
 */

import type { NodePipelineProgress, NodeGenerationResult } from '../../types/pipeline.types';

export interface IGenerationService {
  /**
   * Generate logic for a single node using the STEP 1-7 pipeline.
   *
   * @param options - Generation options
   * @returns Promise with generation result
   *
   * @throws Error if generation fails
   */
  generateNodeLogic(options: GenerationOptions): Promise<NodeGenerationResult>;
}

export interface GenerationOptions {
  nodeId: string;
  nodeLabel: string;
  contract: SemanticContract;
  mode: 'ai' | 'manual';
  includeChildren?: boolean;
  onProgress?: (progress: NodePipelineProgress) => void;
}

export interface SemanticContract {
  entity: {
    label: string;
    type?: string;
    description?: string;
  };
  outputCanonical: {
    format: 'object' | 'value';
  };
  subentities?: Array<{
    subTaskKey: string;
    meaning?: string;
  }>;
  constraints?: Record<string, any>;
}
