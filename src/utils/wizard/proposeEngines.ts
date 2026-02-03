// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import type { TaskTreeNode, TaskTree } from '../../types/taskTypes';
import type { EngineType } from '../../types/semanticContract';
import { EngineEscalationService } from '../../services/EngineEscalationService';
import type { TreeAnalysis } from './analyzeTree';

/**
 * Engine proposal for a node
 */
export interface EngineProposal {
  nodeId: string;
  engines: Array<{
    type: EngineType;
    priority: number;
    enabled: boolean;
    reason: string;
  }>;
}

/**
 * Get entity type from node
 * Pure function: input → output
 */
function getEntityType(node: TaskTreeNode): string {
  // Try multiple sources for entity type
  if (node.type && typeof node.type === 'string') {
    return node.type;
  }
  // Fallback to 'generic' if type is not available
  return 'generic';
}

/**
 * Find node by ID in tree
 * Pure function: input → output
 */
function findNode(nodeId: string, nodes: TaskTreeNode[]): TaskTreeNode | null {
  for (const node of nodes) {
    if ((node.id || node.templateId) === nodeId) {
      return node;
    }
    if (node.subNodes) {
      const found = findNode(nodeId, node.subNodes);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Propose engines for each node based on entity type and structure
 * Pure function: input → output, no side effects
 */
export function proposeEngines(analysis: TreeAnalysis, taskTree: TaskTree | null): EngineProposal[] {
  if (!taskTree || !taskTree.nodes) {
    return [];
  }

  const proposals: EngineProposal[] = [];

  // Propose engines for each node that needs them
  for (const nodeAnalysis of analysis.allNodes) {
    if (nodeAnalysis.hasEngines) {
      continue; // Skip nodes that already have engines
    }

    const node = findNode(nodeAnalysis.nodeId, taskTree.nodes);
    if (!node) continue;

    const entityType = getEntityType(node);
    const defaultEscalation = EngineEscalationService.getDefaultEscalation(nodeAnalysis.nodeId, entityType);

    proposals.push({
      nodeId: nodeAnalysis.nodeId,
      engines: defaultEscalation.engines.map(e => ({
        ...e,
        reason: `Default escalation for ${entityType} entity type`
      }))
    });
  }

  return proposals;
}
