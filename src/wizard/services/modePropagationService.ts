// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Mode Propagation Service
 *
 * Handles propagation of node modes (IA/Manual/Postponed).
 * Pure business logic, no UI dependencies.
 */

import type { SchemaNode, NodeMode } from '../types/wizard.types';
import { setNodeModeWithPropagation } from '../state/modeState';

/**
 * Propagate mode to a node and its children
 * When mode is 'ai', all children are automatically set to 'ai'
 */
export function propagateMode(
  structure: SchemaNode[],
  nodeId: string,
  mode: NodeMode
): SchemaNode[] {
  return structure.map(node => {
    if (node.id === nodeId) {
      return setNodeModeWithPropagation(node, mode);
    }

    // Recursively check sub-nodes
    const subData = node.subData || [];
    const subTasks = node.subTasks || [];
    const allSubNodes = subTasks.length > 0 ? subTasks : subData;

    if (allSubNodes.length > 0) {
      const updatedSubNodes = allSubNodes.map(subNode => {
        if (subNode.id === nodeId) {
          return setNodeModeWithPropagation(subNode, mode);
        }
        // Recursively check nested sub-nodes
        return subNode; // Placeholder - would need recursive update
      });

      if (subTasks.length > 0) {
        return {
          ...node,
          subTasks: updatedSubNodes
        };
      } else {
        return {
          ...node,
          subData: updatedSubNodes
        };
      }
    }

    return node;
  });
}

/**
 * Set mode for a single node without propagation
 * Used when user explicitly changes a child node mode
 */
export function setModeWithoutPropagation(
  structure: SchemaNode[],
  nodeId: string,
  mode: NodeMode
): SchemaNode[] {
  function updateNode(node: SchemaNode): SchemaNode {
    if (node.id === nodeId) {
      return {
        ...node,
        mode
      };
    }

    const subData = node.subData || [];
    const subTasks = node.subTasks || [];
    const allSubNodes = subTasks.length > 0 ? subTasks : subData;

    if (allSubNodes.length > 0) {
      const updatedSubNodes = allSubNodes.map(updateNode);

      if (subTasks.length > 0) {
        return {
          ...node,
          subTasks: updatedSubNodes
        };
      } else {
        return {
          ...node,
          subData: updatedSubNodes
        };
      }
    }

    return node;
  }

  return structure.map(updateNode);
}

/**
 * Find node by ID in structure
 */
export function findNodeById(structure: SchemaNode[], nodeId: string): SchemaNode | null {
  function search(nodes: SchemaNode[]): SchemaNode | null {
    for (const node of nodes) {
      if (node.id === nodeId) {
        return node;
      }

      const subData = node.subData || [];
      const subTasks = node.subTasks || [];
      const allSubNodes = subTasks.length > 0 ? subTasks : subData;

      if (allSubNodes.length > 0) {
        const found = search(allSubNodes);
        if (found) {
          return found;
        }
      }
    }
    return null;
  }

  return search(structure);
}

/**
 * Get all node IDs in structure
 */
export function getAllNodeIds(structure: SchemaNode[]): string[] {
  const ids: string[] = [];

  function collect(nodes: SchemaNode[]) {
    for (const node of nodes) {
      if (node.id) {
        ids.push(node.id);
      }

      const subData = node.subData || [];
      const subTasks = node.subTasks || [];
      const allSubNodes = subTasks.length > 0 ? subTasks : subData;

      if (allSubNodes.length > 0) {
        collect(allSubNodes);
      }
    }
  }

  collect(structure);
  return ids;
}

/**
 * Check mode consistency across structure
 */
export function checkModeConsistency(structure: SchemaNode[]): {
  consistent: boolean;
  inconsistencies: Array<{ nodeId: string; nodeLabel: string; issue: string }>;
} {
  const inconsistencies: Array<{ nodeId: string; nodeLabel: string; issue: string }> = [];

  function check(node: SchemaNode, parentMode?: NodeMode) {
    if (parentMode === 'ai' && node.mode !== 'ai') {
      inconsistencies.push({
        nodeId: node.id || 'unknown',
        nodeLabel: node.label,
        issue: `Parent is in AI mode but child is in ${node.mode || 'undefined'} mode`
      });
    }

    const subData = node.subData || [];
    const subTasks = node.subTasks || [];
    const allSubNodes = subTasks.length > 0 ? subTasks : subData;

    for (const subNode of allSubNodes) {
      check(subNode, node.mode);
    }
  }

  for (const node of structure) {
    check(node);
  }

  return {
    consistent: inconsistencies.length === 0,
    inconsistencies
  };
}
