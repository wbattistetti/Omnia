// Condition Builder: Constructs conditions from flowchart topology

import type { Condition } from './types';
import type { Node, Edge } from 'reactflow';
import type { NodeData, EdgeData } from '../Flowchart/types/flowTypes';

/**
 * Builds condition for first row of a node
 */
export function buildFirstRowCondition(
  nodeId: string,
  nodes: Node<NodeData>[],
  edges: Edge<EdgeData>[]
): Condition | null {
  // Find incoming edges
  const incomingEdges = edges.filter(e => e.target === nodeId);

  // Entry node: always executable
  if (incomingEdges.length === 0) {
    return { type: 'Always' };
  }

  // Build conditions for each parent
  const parentConditions: Condition[] = [];

  for (const edge of incomingEdges) {
    const parentNode = nodes.find(n => n.id === edge.source);
    if (!parentNode) continue;

    const rows = parentNode.data.rows || [];
    if (rows.length === 0) continue;

    // Get last row's taskId
    const lastRow = rows[rows.length - 1];
    const lastTaskId = lastRow.taskId || lastRow.id; // Fallback to row.id if no taskId

    // Condition: last task of parent must be executed
    const taskCondition: Condition = {
      type: 'TaskState',
      taskId: lastTaskId,
      state: 'Executed'
    };

    parentConditions.push(taskCondition);

    // If edge has condition, add it
    if (edge.data?.condition) {
      parentConditions.push({
        type: 'EdgeCondition',
        edgeId: edge.id,
        condition: edge.data.condition
      });
    }
  }

  // If only one parent, return single condition
  if (parentConditions.length === 1) {
    return parentConditions[0];
  }

  // Multiple parents: all must be satisfied
  return {
    type: 'And',
    conditions: parentConditions
  };
}

/**
 * Builds condition for subsequent row (previous row completed)
 */
export function buildSequentialCondition(previousTaskId: string): Condition {
  return {
    type: 'TaskState',
    taskId: previousTaskId,
    state: 'Executed'
  };
}

/**
 * Builds condition for DDT step based on retrieval state
 */
export function buildStepCondition(stepType: string): Condition {
  const retrievalStateMap: Record<string, string> = {
    'start': 'empty',
    'noMatch': 'asrNoMatch',
    'noInput': 'asrNoInput',
    'confirmation': 'saturated',
    'success': 'confirmed'
  };

  const retrievalState = retrievalStateMap[stepType] || 'empty';

  return {
    type: 'RetrievalState',
    state: retrievalState as any
  };
}

/**
 * Builds condition for first action in recovery (step activated)
 */
export function buildRecoveryFirstActionCondition(stepId: string): Condition {
  return {
    type: 'StepActivated',
    stepId
  };
}

/**
 * Builds condition for subsequent action in recovery (previous action completed)
 */
export function buildRecoverySequentialCondition(previousActionTaskId: string): Condition {
  return {
    type: 'TaskState',
    taskId: previousActionTaskId,
    state: 'Executed'
  };
}

