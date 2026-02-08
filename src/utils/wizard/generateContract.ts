// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import type { TaskTreeNode } from '../../types/taskTypes';
import type { SemanticContract } from '../../types/semanticContract';
import { buildSemanticContract } from '../contract/buildEntity';
import { SemanticContractService } from '../../services/SemanticContractService';
import type { GenerationProgress } from './types';

/**
 * Generate contract for a single node
 * Side effect: saves contract to SemanticContractService
 */
export async function generateContractForNode(
  node: TaskTreeNode,
  onProgress?: (progress: GenerationProgress) => void
): Promise<SemanticContract | null> {
  const nodeId = node.id || node.templateId;

  if (onProgress) {
    onProgress({
      currentStep: 0,
      totalSteps: 1,
      currentNodeId: nodeId,
      currentNodeLabel: node.label || nodeId,
      currentAction: 'Generating semantic contract...',
      percentage: 0
    });
  }

  // Build contract deterministically from node
  const contract = buildSemanticContract(node);

  if (!contract) {
    console.error(`[Wizard] Failed to build contract for node ${nodeId}`);
    return null;
  }

  // Save contract
  await SemanticContractService.save(nodeId, contract);

  if (onProgress) {
    onProgress({
      currentStep: 1,
      totalSteps: 1,
      currentNodeId: nodeId,
      currentNodeLabel: node.label || nodeId,
      currentAction: 'Contract generated and saved',
      percentage: 100
    });
  }

  return contract;
}
