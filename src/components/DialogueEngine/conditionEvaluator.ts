// Condition Evaluator: Evaluates conditions for task execution

import type { Condition, ExecutionState, RetrievalState } from '../FlowCompiler/types';

/**
 * Evaluates a condition against current execution state
 */
export function evaluateCondition(
  condition: Condition | null,
  state: ExecutionState
): boolean {
  // Null condition = always true (entry node)
  if (!condition) {
    return true;
  }

  switch (condition.type) {
    case 'Always':
      return true;

    case 'TaskState':
      return state.executedTaskIds.has(condition.taskId) && condition.state === 'Executed';

    case 'RetrievalState':
      return state.retrievalState === condition.state;

    case 'StepActivated':
      // Step is activated if any task from that step is executed
      // This is a simplified check - in practice, we'd track active steps
      return state.executedTaskIds.has(condition.stepId);

    case 'EdgeCondition':
      // Evaluate edge condition (e.g., variable checks)
      return evaluateEdgeCondition(condition.condition, state.variableStore);

    case 'And':
      return condition.conditions.every(c => evaluateCondition(c, state));

    case 'Or':
      return condition.conditions.some(c => evaluateCondition(c, state));

    default:
      console.warn(`[ConditionEvaluator] Unknown condition type: ${(condition as any).type}`);
      return false;
  }
}

/**
 * Evaluates edge condition (variable checks, etc.)
 */
function evaluateEdgeCondition(
  edgeCondition: any,
  variableStore: Record<string, any>
): boolean {
  if (!edgeCondition) return true;

  // Simple variable check: { variable: 'name', operator: '===', value: 'John' }
  if (edgeCondition.variable && edgeCondition.operator && edgeCondition.value !== undefined) {
    const variableValue = variableStore[edgeCondition.variable];

    switch (edgeCondition.operator) {
      case '===':
        return variableValue === edgeCondition.value;
      case '!==':
        return variableValue !== edgeCondition.value;
      case '>':
        return variableValue > edgeCondition.value;
      case '<':
        return variableValue < edgeCondition.value;
      case '>=':
        return variableValue >= edgeCondition.value;
      case '<=':
        return variableValue <= edgeCondition.value;
      default:
        return false;
    }
  }

  // Complex condition (function, etc.)
  if (typeof edgeCondition === 'function') {
    return edgeCondition(variableStore);
  }

  // Default: true if condition exists
  return true;
}

