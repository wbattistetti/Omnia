// Condition Builder: Constructs conditions from flowchart topology

import type { Condition } from './types';
import type { FlowNode, FlowEdge, NodeData, EdgeData } from '../types';

/**
 * Builds condition for first row of a node
 */
export function buildFirstRowCondition(
  nodeId: string,
  nodes: FlowNode[],
  edges: FlowEdge[]
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
  // Special case: If an edge has isElse: true, it becomes: (Parent.Executed ∧ NOT(OR of all other conditions from same source))
  const linkConditions: Condition[] = [];
  const elseEdges: FlowEdge[] = [];

  // First pass: separate Else edges from normal edges
  for (const edge of incomingEdges) {
    // ✅ FIX: Also check if label is 'Else' even if isElse flag is missing
    if (edge.data?.isElse === true || edge.label === 'Else') {
      elseEdges.push(edge);
      // ✅ DEBUG: Log when Else edge is found (to verify isElse preservation)
      if (edge.data?.isElse === true) {
        console.log('[ConditionBuilder] ✅ Found Else edge with isElse flag', {
          nodeId,
          edgeId: edge.id,
          edgeLabel: edge.label,
          isElse: edge.data.isElse
        });
      }
    }
  }

  // Build conditions for normal (non-Else) edges
  for (const edge of incomingEdges) {
    // Skip Else edges in first pass - they'll be handled separately
    if (edge.data?.isElse === true) {
      continue;
    }

    const parentNode = nodes.find(n => n.id === edge.source);
    if (!parentNode) continue;

    const rows = parentNode.data.rows || [];
    if (rows.length === 0) continue;

    // Get last row's taskId
    const lastRow = rows[rows.length - 1];
    // ✅ FIX: Use lastRow.taskId if present, otherwise fallback to lastRow.id
    const lastTaskId = lastRow.taskId || lastRow.id;

    // Build condition for this link: (Parent.Executed ∧ Link.Condition)
    const linkConditionParts: Condition[] = [
      {
        type: 'TaskState',
        taskId: lastTaskId,
        state: 'Executed'
      }
    ];

    // If edge has condition, add it (AND with parent executed)
    // Check both edge.data.condition and edge.data.conditionId for compatibility
    const conditionId = edge.data?.conditionId || edge.data?.condition;
    if (conditionId) {
      linkConditionParts.push({
        type: 'EdgeCondition',
        edgeId: edge.id,
        condition: conditionId // Pass conditionId (GUID) to evaluator
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

  // Second pass: handle Else edges
  // For each Else edge, build: (Parent.Executed ∧ NOT(OR of all other conditions from same source))
  for (const elseEdge of elseEdges) {
    const parentNode = nodes.find(n => n.id === elseEdge.source);
    if (!parentNode) continue;

    const rows = parentNode.data.rows || [];
    if (rows.length === 0) continue;

    // Get last row's taskId
    const lastRow = rows[rows.length - 1];
    const lastTaskId = lastRow.taskId || lastRow.id;

    // ✅ FIX: Find all edges FROM the same source node (not just incoming to target)
    // This includes edges going to ANY target, not just this one
    // "Gemelle" = link che condividono lo stesso nodo sorgente
    const otherEdgesFromSource = edges.filter(e =>
      e.source === elseEdge.source &&
      e.id !== elseEdge.id &&
      e.data?.isElse !== true
    );

    // ✅ FIX: Extract only edge conditions (without Parent.Executed) for the NOT
    // The Else condition should be: (Parent.Executed ∧ NOT(OR of all other edge conditions))
    // NOT of (Parent.Executed AND C) is wrong - we need NOT(C) only
    const otherEdgeConditions: Condition[] = [];
    for (const otherEdge of otherEdgesFromSource) {
      const otherConditionId = otherEdge.data?.conditionId || otherEdge.data?.condition;
      if (otherConditionId) {
        // Extract only the edge condition, without Parent.Executed
        otherEdgeConditions.push({
          type: 'EdgeCondition',
          edgeId: otherEdge.id,
          condition: otherConditionId
        });
      }
    }

    // Build Else condition: (Parent.Executed ∧ NOT(OR of all other edge conditions))
    const elseConditionParts: Condition[] = [
      {
        type: 'TaskState',
        taskId: lastTaskId,
        state: 'Executed'
      }
    ];

    if (otherEdgeConditions.length > 0) {
      // Create NOT(OR of all other edge conditions) - WITHOUT Parent.Executed
      const orOfEdgeConditions: Condition = otherEdgeConditions.length === 1
        ? otherEdgeConditions[0]
        : {
            type: 'Or',
            conditions: otherEdgeConditions
          };

      const notCondition: Condition = {
        type: 'Not',
        condition: orOfEdgeConditions
      };

      elseConditionParts.push(notCondition);
    }
    // If no other conditions exist, Else is just (Parent.Executed)

    const elseLinkCondition: Condition = elseConditionParts.length === 1
      ? elseConditionParts[0]
      : {
          type: 'And',
          conditions: elseConditionParts
        };

    linkConditions.push(elseLinkCondition);
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

