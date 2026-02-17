// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import type { TaskTreeNode, TaskTree } from '../../types/taskTypes';
import type { SemanticContract } from '../../types/semanticContract';
import { buildSemanticContract } from '../contract/buildEntity';
import { SemanticContractService } from '../../services/SemanticContractService';
import { DialogueTaskService } from '../../services/DialogueTaskService';
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

/**
 * Collect all nodes recursively from TaskTree (main + subNodes)
 * Helper function for generateContractsForAllNodes
 */
function collectAllNodes(nodes: TaskTreeNode[]): TaskTreeNode[] {
  const allNodes: TaskTreeNode[] = [];

  const traverse = (nodeList: TaskTreeNode[]) => {
    for (const node of nodeList) {
      allNodes.push(node);
      if (node.subNodes && Array.isArray(node.subNodes) && node.subNodes.length > 0) {
        traverse(node.subNodes);
      }
    }
  };

  traverse(nodes);
  return allNodes;
}

/**
 * Generate contracts for all nodes in TaskTree (idempotent)
 *
 * ARCHITECTURAL RULES:
 * - Contract is deterministic (derives only from node structure)
 * - Contract is generated ONCE and saved in SemanticContractService
 * - This function is IDEMPOTENT: skips nodes that already have contracts
 * - Executes in parallel for all nodes (non-blocking)
 * - Does NOT modify existing contracts
 *
 * @param taskTree - TaskTree with nodes to generate contracts for
 * @returns Map of nodeId -> contract (only newly generated contracts)
 */
export async function generateContractsForAllNodes(
  taskTree: TaskTree
): Promise<Map<string, SemanticContract>> {
  if (!taskTree || !taskTree.nodes || taskTree.nodes.length === 0) {
    console.log('[generateContractsForAllNodes] TaskTree is empty, skipping contract generation');
    return new Map();
  }

  // Collect all nodes recursively (main + subNodes)
  const allNodes = collectAllNodes(taskTree.nodes);
  console.log('[generateContractsForAllNodes] Collected nodes', {
    totalNodes: allNodes.length,
    mainNodes: taskTree.nodes.length,
    nodeIds: allNodes.map(n => n.id || n.templateId)
  });

  // ✅ FASE 2: Filter nodes that have templates in cache BEFORE checking contracts
  // This prevents errors when trying to save contracts for nodes without templates
  const nodesWithTemplates = allNodes.filter(node => {
    const nodeId = node.id || node.templateId;
    const template = DialogueTaskService.getTemplate(nodeId);
    if (!template) {
      console.warn(`[generateContractsForAllNodes] ⚠️ Skipping node ${nodeId} - template not in cache`, {
        nodeLabel: node.label,
        nodeId
      });
      return false;
    }
    return true;
  });

  console.log('[generateContractsForAllNodes] Template availability check', {
    totalNodes: allNodes.length,
    nodesWithTemplates: nodesWithTemplates.length,
    nodesWithoutTemplates: allNodes.length - nodesWithTemplates.length
  });

  // Check which nodes already have contracts (idempotency check)
  const contractChecks = await Promise.all(
    nodesWithTemplates.map(async (node) => {
      const nodeId = node.id || node.templateId;
      const exists = await SemanticContractService.exists(nodeId);
      return { node, nodeId, exists };
    })
  );

  // Filter nodes that need contracts (idempotent: skip existing)
  const nodesToGenerate = contractChecks
    .filter(({ exists }) => !exists)
    .map(({ node, nodeId }) => ({ node, nodeId }));

  console.log('[generateContractsForAllNodes] Contract generation plan', {
    totalNodes: allNodes.length,
    nodesWithTemplates: nodesWithTemplates.length,
    nodesWithContracts: contractChecks.filter(c => c.exists).length,
    nodesToGenerate: nodesToGenerate.length,
    nodeIdsToGenerate: nodesToGenerate.map(n => n.nodeId)
  });

  if (nodesToGenerate.length === 0) {
    console.log('[generateContractsForAllNodes] All nodes already have contracts, skipping generation');
    return new Map();
  }

  // Generate contracts in parallel (non-blocking, deterministic)
  const generationResults = await Promise.allSettled(
    nodesToGenerate.map(async ({ node, nodeId }) => {
      try {
        const contract = buildSemanticContract(node);
        if (!contract) {
          console.error(`[generateContractsForAllNodes] Failed to build contract for node ${nodeId}`);
          return { nodeId, contract: null, error: 'buildSemanticContract returned null' };
        }

        // Save contract (idempotent: only saves if not exists)
        await SemanticContractService.save(nodeId, contract);
        console.log(`[generateContractsForAllNodes] ✅ Contract generated and saved for node ${nodeId}`, {
          nodeLabel: node.label,
          entityLabel: contract.entity?.label,
          subentitiesCount: contract.subentities?.length || 0
        });

        return { nodeId, contract, error: null };
      } catch (error) {
        console.error(`[generateContractsForAllNodes] ❌ Error generating contract for node ${nodeId}:`, error);
        return {
          nodeId,
          contract: null,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    })
  );

  // Collect successful results
  const generatedContracts = new Map<string, SemanticContract>();
  const errors: Array<{ nodeId: string; error: string }> = [];

  for (const result of generationResults) {
    if (result.status === 'fulfilled') {
      const { nodeId, contract, error } = result.value;
      if (contract) {
        generatedContracts.set(nodeId, contract);
      } else if (error) {
        errors.push({ nodeId, error });
      }
    } else {
      errors.push({
        nodeId: 'unknown',
        error: result.reason instanceof Error ? result.reason.message : String(result.reason)
      });
    }
  }

  if (errors.length > 0) {
    console.warn('[generateContractsForAllNodes] ⚠️ Some contracts failed to generate', {
      errorsCount: errors.length,
      errors
    });
    // Non-blocking: log errors but don't throw
  }

  console.log('[generateContractsForAllNodes] ✅ Contract generation complete', {
    totalNodes: allNodes.length,
    nodesWithTemplates: nodesWithTemplates.length,
    generated: generatedContracts.size,
    skipped: contractChecks.filter(c => c.exists).length,
    skippedNoTemplate: allNodes.length - nodesWithTemplates.length,
    failed: errors.length
  });

  return generatedContracts;
}
