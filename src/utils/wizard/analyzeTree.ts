// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import type { TaskTreeNode, TaskTree } from '../../types/taskTypes';
import type { EngineType } from '../../types/semanticContract';
import { SemanticContractService } from '../../services/SemanticContractService';
import { EngineEscalationService } from '../../services/EngineEscalationService';

/**
 * Analysis result for a single node
 */
export interface NodeAnalysis {
  nodeId: string;
  nodeLabel: string;
  hasContract: boolean;
  hasEngines: boolean;
  missingEngines: EngineType[];
  contractComplete: boolean;
  isComposite: boolean;
  subNodesCount: number;
}

/**
 * Analysis result for entire tree
 */
export interface TreeAnalysis {
  totalNodes: number;
  nodesWithoutContract: NodeAnalysis[];
  nodesWithoutEngines: NodeAnalysis[];
  nodesWithIncompleteContract: NodeAnalysis[];
  allNodes: NodeAnalysis[];
}

/**
 * Analyze entire task tree to identify missing contracts and engines
 * Pure function: input → output, no side effects
 */
export async function analyzeTree(taskTree: TaskTree | null): Promise<TreeAnalysis> {
  if (!taskTree || !taskTree.nodes || taskTree.nodes.length === 0) {
    return {
      totalNodes: 0,
      nodesWithoutContract: [],
      nodesWithoutEngines: [],
      nodesWithIncompleteContract: [],
      allNodes: []
    };
  }

  const allNodes: NodeAnalysis[] = [];
  const nodesWithoutContract: NodeAnalysis[] = [];
  const nodesWithoutEngines: NodeAnalysis[] = [];
  const nodesWithIncompleteContract: NodeAnalysis[] = [];

  // Recursively analyze all nodes
  const analyzeNode = async (node: TaskTreeNode): Promise<void> => {
    const nodeId = node.id || node.templateId;
    const hasContract = await SemanticContractService.exists(nodeId);
    const escalation = await EngineEscalationService.load(nodeId);
    const hasEngines = escalation !== null && escalation.engines.some(e => e.enabled);

    // Check which engines are missing
    const missingEngines: EngineType[] = [];
    if (escalation) {
      const enabledEngines = escalation.engines.filter(e => e.enabled).map(e => e.type);
      // TODO: Check if engine config exists for this type
      // For now, assume missing if escalation exists but no engines saved
    } else {
      // No escalation = no engines
      missingEngines.push('regex', 'llm', 'rule_based', 'ner', 'embedding');
    }

    const analysis: NodeAnalysis = {
      nodeId,
      nodeLabel: node.label || nodeId,
      hasContract,
      hasEngines,
      missingEngines,
      contractComplete: hasContract, // TODO: Check if contract is complete
      isComposite: !!(node.subNodes && node.subNodes.length > 0),
      subNodesCount: node.subNodes?.length || 0
    };

    allNodes.push(analysis);

    if (!hasContract) {
      nodesWithoutContract.push(analysis);
    }

    if (!hasEngines) {
      nodesWithoutEngines.push(analysis);
    }

    if (hasContract && !analysis.contractComplete) {
      nodesWithIncompleteContract.push(analysis);
    }

    // Recursively analyze sub-nodes
    if (node.subNodes) {
      for (const subNode of node.subNodes) {
        await analyzeNode(subNode);
      }
    }
  };

  // Analyze all root nodes
  for (const node of taskTree.nodes) {
    await analyzeNode(node);
  }

  return {
    totalNodes: allNodes.length,
    nodesWithoutContract,
    nodesWithoutEngines,
    nodesWithIncompleteContract,
    allNodes
  };
}
