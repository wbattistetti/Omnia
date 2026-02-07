// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Strict validators - NO FALLBACKS
 * Throws explicit errors if data doesn't match expected format
 */

import type { TaskTree, TaskTreeNode } from '@types/taskTypes';

export class DataStructureError extends Error {
  constructor(message: string, public context: string, public data?: any) {
    super(message);
    this.name = 'DataStructureError';
  }
}

/**
 * Validates node structure - STRICT, no fallbacks
 */
export function validateNodeStructure(
  node: any,
  context: string = 'unknown'
): asserts node is TaskTreeNode {
  if (!node) {
    throw new DataStructureError(
      'Node is null or undefined',
      context
    );
  }

  // MUST have 'id', not '_id'
  if (node._id && !node.id) {
    throw new DataStructureError(
      `Node uses legacy '_id' property. Expected 'id'. Node: ${JSON.stringify(node).substring(0, 200)}`,
      context,
      node
    );
  }

  if (!node.id) {
    throw new DataStructureError(
      `Node missing 'id' property`,
      context,
      node
    );
  }

  // MUST have 'label', not 'name'
  if (node.name && !node.label) {
    throw new DataStructureError(
      `Node uses legacy 'name' property. Expected 'label'. Node id: ${node.id}`,
      context,
      node
    );
  }

  // MUST use 'subNodes', not 'subData' or 'subSlots'
  if (node.subData || node.subSlots) {
    throw new DataStructureError(
      `Node uses legacy 'subData' or 'subSlots' properties. Expected 'subNodes'. Node id: ${node.id}`,
      context,
      node
    );
  }

  // Steps MUST be dictionary, not array
  if (node.steps && Array.isArray(node.steps)) {
    throw new DataStructureError(
      `Node.steps is array. Expected dictionary format. Node id: ${node.id}`,
      context,
      node
    );
  }

  // No legacy 'messages' property
  if (node.messages && typeof node.messages === 'object') {
    throw new DataStructureError(
      `Node uses legacy 'messages' property. Expected 'steps' dictionary. Node id: ${node.id}`,
      context,
      node
    );
  }
}

/**
 * Validates TaskTree structure - STRICT
 */
export function validateTaskTreeStructure(
  taskTree: any,
  context: string = 'unknown'
): asserts taskTree is TaskTree {
  if (!taskTree) {
    throw new DataStructureError(
      'TaskTree is null or undefined',
      context
    );
  }

  // MUST have 'nodes', not 'data'
  if (taskTree.data && !taskTree.nodes) {
    throw new DataStructureError(
      `TaskTree uses legacy 'data' property. Expected 'nodes'. TaskTree id: ${taskTree.id || taskTree._id}`,
      context,
      taskTree
    );
  }

  if (!Array.isArray(taskTree.nodes)) {
    throw new DataStructureError(
      `TaskTree.nodes is not an array`,
      context,
      taskTree
    );
  }

  // Validate all nodes
  taskTree.nodes.forEach((node: any, index: number) => {
    try {
      validateNodeStructure(node, `${context}.nodes[${index}]`);
    } catch (error) {
      if (error instanceof DataStructureError) {
        throw error;
      }
      throw new DataStructureError(
        `Error validating node at index ${index}: ${error instanceof Error ? error.message : String(error)}`,
        `${context}.nodes[${index}]`,
        node
      );
    }
  });

  // Steps MUST be dictionary
  if (taskTree.steps && (typeof taskTree.steps !== 'object' || Array.isArray(taskTree.steps))) {
    throw new DataStructureError(
      `TaskTree.steps must be a dictionary, not array`,
      context,
      taskTree
    );
  }
}
