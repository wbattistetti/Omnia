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

  // Build conditions for each incoming link
  // Each link condition is: (Parent.Executed ∧ Link.Condition)
  // Final condition is: OR of all link conditions
  const linkConditions: Condition[] = [];

  for (const edge of incomingEdges) {
    const parentNode = nodes.find(n => n.id === edge.source);
    if (!parentNode) continue;

    const rows = parentNode.data.rows || [];
    if (rows.length === 0) continue;

    // Get last row's taskId
    const lastRow = rows[rows.length - 1];
    const lastTaskId = lastRow.taskId || lastRow.id; // Fallback to row.id if no taskId

    // Build condition for this link: (Parent.Executed ∧ Link.Condition)
    const linkConditionParts: Condition[] = [
      {
        type: 'TaskState',
        taskId: lastTaskId,
        state: 'Executed'
      }
    ];

    // If edge has condition, add it (AND with parent executed)
    if (edge.data?.condition) {
      linkConditionParts.push({
        type: 'EdgeCondition',
        edgeId: edge.id,
        condition: edge.data.condition
      });
    }

    // If link has both parts, combine with AND; otherwise use single condition
    const linkCondition: Condition = linkConditionParts.length === 1
      ? linkConditionParts[0]
      : {
          type: 'And',
          conditions: linkConditionParts
        };

    linkConditions.push(linkCondition);
  }

  // If no links, return null (should not happen as entry node is handled above)
  if (linkConditions.length === 0) {
    return null;
  }

  // If only one link, return its condition directly
  if (linkConditions.length === 1) {
    return linkConditions[0];
  }

  // Multiple links: OR of all link conditions
  // Formula: (Parent1.Executed ∧ Link1.Condition) OR (Parent2.Executed ∧ Link2.Condition) OR ...
  return {
    type: 'Or',
    conditions: linkConditions
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

