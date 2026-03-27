// handleErrorFix
// Central handler for fixing compilation errors
// Maps each error type to specific navigation actions in Response Editor

import type { CompilationError, FixTarget } from '../components/FlowCompiler/types';
import type { TaskEditorOpenEvent } from '../components/AppContent/domain/editorEvents';

/**
 * Handles error fix by opening appropriate editor and navigating to the right location
 */
export async function handleErrorFix(error: CompilationError): Promise<void> {
  if (!error.fixTarget) {
    const nodeAmbiguityCategories = new Set([
      'AmbiguousOutgoingLinks',
      'AmbiguousDuplicateEdgeLabels',
      'AmbiguousDuplicateConditionScript',
    ]);
    if (error.nodeId && error.category && nodeAmbiguityCategories.has(error.category)) {
      const ev = new CustomEvent('flowchart:selectNode', {
        detail: { nodeId: error.nodeId },
        bubbles: true,
      });
      document.dispatchEvent(ev);
      return;
    }
    console.warn('[handleErrorFix] Error has no fixTarget:', error);
    return;
  }

  const { type } = error.fixTarget;

  // Handle task-related errors (task, taskRow, taskStep, taskEscalation)
  if (type === 'task' || type === 'taskRow' || type === 'taskStep' || type === 'taskEscalation') {
    await handleTaskErrorFix(error);
  } else if (type === 'edge') {
    await handleEdgeErrorFix(error);
  } else if (type === 'condition') {
    await handleConditionErrorFix(error);
  } else if (type === 'node') {
    await handleNodeErrorFix(error);
  }
}

/**
 * Handles task-related error fixes
 */
async function handleTaskErrorFix(error: CompilationError): Promise<void> {
  const fixTarget = error.fixTarget as Extract<FixTarget, { type: 'task' | 'taskRow' | 'taskStep' | 'taskEscalation' }>;
  const category = error.category || '';

  // Build navigation parameters based on error category
  const navigation: TaskEditorOpenEvent['navigation'] = {
    openBehaviorPanel: true, // Always open Behavior panel for task errors
  };

  // Map error categories to specific navigation actions
  switch (category) {
    case 'TaskNotFound':
    case 'MissingTaskType':
    case 'InvalidTaskType':
    case 'MissingParameter':
    case 'EmptyParameter':
    case 'DuplicateParameter':
    case 'MissingTextKey':
      // For task-level errors, just open Behavior panel
      if (fixTarget.type === 'taskStep') {
        navigation.stepKey = fixTarget.stepKey;
      }
      break;

    case 'MissingPrompt':
      // Navigate to step and open prompt editor
      if (fixTarget.type === 'taskStep') {
        navigation.stepKey = fixTarget.stepKey;
        navigation.autoEditTarget = {
          escIdx: 0, // First escalation
          taskIdx: 0, // First task (or missing one)
        };
      }
      break;

    case 'EmptyPrompt':
      // Navigate to step and open prompt editor for empty prompt
      if (fixTarget.type === 'taskStep') {
        navigation.stepKey = fixTarget.stepKey;
        navigation.autoEditTarget = {
          escIdx: 0,
          taskIdx: 0,
        };
      }
      break;

    case 'MissingEscalation':
    case 'EmptyEscalation':
      // Navigate to step and highlight missing/empty escalation
      if (fixTarget.type === 'taskStep') {
        navigation.stepKey = fixTarget.stepKey;
      }
      break;

    case 'MissingFinalEscalation':
      // Navigate to step, open Tasks panel, and highlight last escalation
      if (fixTarget.type === 'taskStep' || fixTarget.type === 'taskEscalation') {
        navigation.stepKey = fixTarget.stepKey;
        navigation.openTasksPanel = true; // Open Tasks panel to add CloseSession/Transfer
        if (fixTarget.type === 'taskEscalation' && fixTarget.escalationIndex !== undefined) {
          navigation.escalationIndex = fixTarget.escalationIndex;
        }
      }
      break;

    case 'NotConfirmedWithoutConfirm':
      // Navigate to notConfirmed step
      if (fixTarget.type === 'taskStep') {
        navigation.stepKey = fixTarget.stepKey;
      }
      break;

    default:
      // Default: just open Behavior panel
      if (fixTarget.type === 'taskStep') {
        navigation.stepKey = fixTarget.stepKey;
      }
      break;
  }

  // Open Response Editor with navigation
  const event = new CustomEvent<TaskEditorOpenEvent>('taskEditor:open', {
    detail: {
      id: fixTarget.taskId,
      type: 1, // Default to UtteranceInterpretation - will be inferred from task
      navigation,
    },
    bubbles: true,
  });
  document.dispatchEvent(event);

  // Emit navigation event after Response Editor is mounted (small delay)
  setTimeout(() => {
    const navEvent = new CustomEvent('taskEditor:navigate', {
      detail: navigation,
      bubbles: true,
    });
    document.dispatchEvent(navEvent);
  }, 100);
}

/**
 * Handles edge-related error fixes
 */
async function handleEdgeErrorFix(error: CompilationError): Promise<void> {
  const fixTarget = error.fixTarget as Extract<FixTarget, { type: 'edge' }>;

  // Find edge from flowchart
  // This requires access to flowchart state - we'll use a custom event
  const ev = new CustomEvent('flowchart:findEdge', {
    detail: { edgeId: fixTarget.edgeId },
    bubbles: true,
  });
  document.dispatchEvent(ev);

  // Wait for edge to be found, then open condition editor
  // For now, we'll use a simpler approach: emit conditionEditor:open directly
  // The edge label will be extracted by the handler
  const conditionEvent = new CustomEvent('conditionEditor:open', {
    detail: {
      label: 'Condition', // Will be updated by handler
      script: '',
      nodeId: error.nodeId || undefined,
      needsGeneration: true,
    },
    bubbles: true,
  });
  document.dispatchEvent(conditionEvent);
}

/**
 * Handles condition-related error fixes
 */
async function handleConditionErrorFix(error: CompilationError): Promise<void> {
  const fixTarget = error.fixTarget as Extract<FixTarget, { type: 'condition' }>;

  // Open condition editor
  const ev = new CustomEvent('conditionEditor:open', {
    detail: {
      label: 'Condition',
      script: '',
      needsGeneration: true,
    },
    bubbles: true,
  });
  document.dispatchEvent(ev);
}

/**
 * Handles node-related error fixes
 */
async function handleNodeErrorFix(error: CompilationError): Promise<void> {
  const fixTarget = error.fixTarget as Extract<FixTarget, { type: 'node' }>;

  // Select node in flowchart (if needed)
  const ev = new CustomEvent('flowchart:selectNode', {
    detail: { nodeId: fixTarget.nodeId },
    bubbles: true,
  });
  document.dispatchEvent(ev);
}
