/**
 * Single entry point for “Fix” on compilation errors: same programmatic actions as clicking
 * the flow (wrench on edge → Condition Editor with edgeId/target/flowId; gear on row → Task Editor).
 * Exported helpers support deduplicating the error panel when message + fix target match.
 */

import type { CompilationError, FixTarget } from '@components/FlowCompiler/types';
import type { TaskEditorOpenEvent } from '@components/AppContent/domain/editorEvents';
import { splitFlowPrefixedMessage } from '@utils/flowPrefixedMessage';
import { FlowStateBridge } from '@services/FlowStateBridge';
import { resolveEdgeCaption } from '@components/Flowchart/utils/edgeConditionState';
import { getActiveFlowCanvasId } from '@flows/activeFlowCanvas';
import { taskRepository } from '@services/TaskRepository';
import { TaskType, normalizeLegacyTaskTypeValue } from '@types/taskTypes';

/**
 * Flowchart row id equals task instance id in taskRepository; prefer it over referenced task id.
 */
function resolveCompilationFixInstanceId(error: CompilationError): string {
  const rowId = error.rowId?.trim();
  if (rowId) return rowId;
  const ft = error.fixTarget;
  if (ft && 'taskId' in ft && typeof ft.taskId === 'string' && ft.taskId.trim()) {
    return ft.taskId.trim();
  }
  return error.taskId;
}

/**
 * Task type for editor selection: compiler payload first, then repository, then UNDEFINED.
 */
function resolveCompilationFixTaskType(error: CompilationError, instanceId: string): TaskType {
  const n = error.taskType;
  if (typeof n === 'number' && Number.isFinite(n)) {
    return normalizeLegacyTaskTypeValue(n);
  }
  const fromRepo = taskRepository.getTask(instanceId)?.type;
  if (fromRepo !== undefined && fromRepo !== null) {
    return fromRepo;
  }
  return TaskType.UNDEFINED;
}

/** Flow id from optional `[flowId] message` on merged compile errors; default `main`. */
export function compilationErrorFlowId(error: CompilationError): string {
  const { flowTag } = splitFlowPrefixedMessage(error.message);
  const id = flowTag?.trim();
  return id || 'main';
}

/**
 * Stable key: same key ⇒ same Fix behavior (open same editor at same target).
 * Used to dedupe identical human lines in the error report.
 */
export function compilationErrorFixKey(error: CompilationError): string {
  const ft = error.fixTarget;
  if (!ft) {
    return `noTarget:${error.category ?? ''}:${error.nodeId ?? ''}:${error.edgeId ?? ''}:${error.taskId}`;
  }
  switch (ft.type) {
    case 'edge':
      return `edge:${ft.edgeId}`;
    case 'node':
      return `node:${ft.nodeId}`;
    case 'condition':
      return `condition:${ft.conditionId}`;
    case 'taskRow':
      return `taskRow:${ft.taskId}:${ft.rowId}`;
    case 'taskStep':
      return `taskStep:${ft.taskId}:${ft.stepKey}`;
    case 'taskEscalation':
      return `taskEsc:${ft.taskId}:${ft.stepKey}:${ft.escalationIndex ?? 0}`;
    case 'iaRuntime':
      return `iaRuntime:${ft.taskId}:${ft.focus}`;
    case 'task':
      return `task:${ft.taskId}`;
    default:
      return `task:${error.taskId}`;
  }
}

/**
 * Runs the same navigation as the flowchart affordances (wrench / gear / node select).
 */
export async function runCompilationErrorFix(error: CompilationError): Promise<void> {
  if (error.fixTarget?.type === 'iaRuntime') {
    const ft = error.fixTarget;
    const navigateError: CompilationError = {
      ...error,
      fixTarget: { type: 'task', taskId: ft.taskId },
    };
    await openTaskEditorForCompilationError(navigateError);
    window.setTimeout(() => {
      document.dispatchEvent(
        new CustomEvent('omnia:ia-runtime-focus', {
          detail: { taskInstanceId: ft.taskId, focus: ft.focus },
          bubbles: true,
        })
      );
    }, 420);
    return;
  }

  if (!error.fixTarget) {
    const nodeAmbiguityCategories = new Set([
      'AmbiguousLink',
      'AmbiguousOutgoingLinks',
      'AmbiguousDuplicateEdgeLabels',
      'AmbiguousDuplicateConditionScript',
    ]);
    if (error.nodeId && error.category && nodeAmbiguityCategories.has(error.category)) {
      document.dispatchEvent(
        new CustomEvent('flowchart:selectNode', {
          detail: { nodeId: error.nodeId },
          bubbles: true,
        })
      );
      return;
    }
    console.warn('[compilationErrorFix] Error has no fixTarget:', error);
    return;
  }

  const { type } = error.fixTarget;

  if (type === 'task' || type === 'taskRow' || type === 'taskStep' || type === 'taskEscalation') {
    await openTaskEditorForCompilationError(error);
  } else if (type === 'edge') {
    await openConditionEditorForEdgeCompilationError(error);
  } else if (type === 'condition') {
    await openConditionEditorForConditionCompilationError(error);
  } else if (type === 'node') {
    await openNodeSelectionForCompilationError(error);
  }
}

async function openTaskEditorForCompilationError(error: CompilationError): Promise<void> {
  const fixTarget = error.fixTarget as Extract<
    FixTarget,
    { type: 'task' | 'taskRow' | 'taskStep' | 'taskEscalation' }
  >;
  const category = error.category || '';

  const navigation: TaskEditorOpenEvent['navigation'] = {
    openBehaviorPanel: true,
  };

  const code = (error.code ?? '').trim();

  if (code === 'ParserMissing') {
    navigation.openRecognition = true;
    navigation.openBehaviorPanel = false;
    navigation.openTasksPanel = false;
  } else if (code === 'EscalationActionsMissing' && fixTarget.type === 'taskEscalation') {
    navigation.stepKey = fixTarget.stepKey;
    navigation.openTasksPanel = true;
    navigation.openBehaviorPanel = false;
    if (fixTarget.escalationIndex !== undefined) {
      navigation.escalationIndex = fixTarget.escalationIndex;
    }
  } else switch (category) {
    case 'MissingOrInvalidTask':
    case 'TaskNotFound':
    case 'MissingTaskType':
    case 'InvalidTaskType':
    case 'TaskTypeInvalidOrMissing':
    case 'TaskCompilationFailed':
    case 'MissingParameter':
    case 'EmptyParameter':
    case 'DuplicateParameter':
    case 'MissingTextKey':
      if (fixTarget.type === 'taskStep') {
        navigation.stepKey = fixTarget.stepKey;
      }
      break;

    case 'MissingPrompt':
      if (fixTarget.type === 'taskStep') {
        navigation.stepKey = fixTarget.stepKey;
        navigation.autoEditTarget = { escIdx: 0, taskIdx: 0 };
      }
      break;

    case 'EmptyPrompt':
      if (fixTarget.type === 'taskStep') {
        navigation.stepKey = fixTarget.stepKey;
        navigation.autoEditTarget = { escIdx: 0, taskIdx: 0 };
      }
      break;

    case 'MissingEscalation':
    case 'EmptyEscalation':
      if (fixTarget.type === 'taskEscalation') {
        navigation.stepKey = fixTarget.stepKey;
        navigation.openTasksPanel = true;
        navigation.openBehaviorPanel = false;
        if (fixTarget.escalationIndex !== undefined) {
          navigation.escalationIndex = fixTarget.escalationIndex;
        }
      } else if (fixTarget.type === 'taskStep') {
        navigation.stepKey = fixTarget.stepKey;
      }
      break;

    case 'MissingFinalEscalation':
      if (fixTarget.type === 'taskStep' || fixTarget.type === 'taskEscalation') {
        navigation.stepKey = fixTarget.stepKey;
        navigation.openTasksPanel = true;
        navigation.openBehaviorPanel = false;
        if (fixTarget.type === 'taskEscalation' && fixTarget.escalationIndex !== undefined) {
          navigation.escalationIndex = fixTarget.escalationIndex;
        }
      }
      break;

    case 'NotConfirmedWithoutConfirm':
      if (fixTarget.type === 'taskStep') {
        navigation.stepKey = fixTarget.stepKey;
      }
      break;

    default:
      if (fixTarget.type === 'taskStep') {
        navigation.stepKey = fixTarget.stepKey;
      }
      break;
  }

  const instanceId = resolveCompilationFixInstanceId(error);
  const resolvedTaskType = resolveCompilationFixTaskType(error, instanceId);
  const flowId = compilationErrorFlowId(error);

  const event = new CustomEvent<TaskEditorOpenEvent>('taskEditor:open', {
    detail: {
      id: instanceId,
      type: resolvedTaskType,
      flowId,
      navigation,
    },
    bubbles: true,
  });
  document.dispatchEvent(event);

  /** Editor tab mounts asynchronously; delay + retries inside ResponseEditorNavigationContext scroll helpers. */
  window.setTimeout(() => {
    document.dispatchEvent(
      new CustomEvent('taskEditor:navigate', {
        detail: { navigation },
        bubbles: true,
      })
    );
  }, 220);
}

/**
 * Opens Condition Editor with the same payload shape as CustomEdge (wrench): edgeId, target nodeId,
 * conditionId when present, flow scope, caption as label.
 */
async function openConditionEditorForEdgeCompilationError(error: CompilationError): Promise<void> {
  const fixTarget = error.fixTarget as Extract<FixTarget, { type: 'edge' }>;
  const flowId = compilationErrorFlowId(error);
  const edge = FlowStateBridge.findEdge(fixTarget.edgeId);

  let label = 'Condition';
  let nodeId: string | undefined = error.nodeId;
  let conditionId: string | undefined = error.conditionId?.trim() || undefined;

  if (edge) {
    const e = edge as {
      label?: string;
      target?: string;
      conditionId?: string;
      isElse?: boolean;
      data?: Record<string, unknown>;
    };
    const cap = resolveEdgeCaption({
      label: e.label,
      conditionId: e.conditionId,
      isElse: e.isElse,
      data: e.data ?? undefined,
    });
    if (cap?.trim()) {
      label = cap.trim();
    }
    const tgt = typeof e.target === 'string' ? e.target.trim() : '';
    if (tgt) {
      nodeId = tgt;
    }
    const edgeCid = e.conditionId;
    if (edgeCid != null && String(edgeCid).trim()) {
      conditionId = String(edgeCid).trim();
    }
  }

  if (nodeId) {
    document.dispatchEvent(
      new CustomEvent('flowchart:selectNode', {
        detail: { nodeId },
        bubbles: true,
      })
    );
  }

  const resolvedFlowId = flowId || getActiveFlowCanvasId();

  document.dispatchEvent(
    new CustomEvent('conditionEditor:open', {
      detail: {
        label,
        name: label,
        nodeId,
        edgeId: fixTarget.edgeId,
        conditionId,
        readableCode: '',
        flowId: resolvedFlowId,
      },
      bubbles: true,
    })
  );
}

async function openConditionEditorForConditionCompilationError(error: CompilationError): Promise<void> {
  const fixTarget = error.fixTarget as Extract<FixTarget, { type: 'condition' }>;
  const flowId = compilationErrorFlowId(error) || getActiveFlowCanvasId();
  document.dispatchEvent(
    new CustomEvent('conditionEditor:open', {
      detail: {
        label: 'Condition',
        name: 'Condition',
        conditionId: fixTarget.conditionId,
        flowId,
      },
      bubbles: true,
    })
  );
}

async function openNodeSelectionForCompilationError(error: CompilationError): Promise<void> {
  const fixTarget = error.fixTarget as Extract<FixTarget, { type: 'node' }>;
  document.dispatchEvent(
    new CustomEvent('flowchart:selectNode', {
      detail: { nodeId: fixTarget.nodeId },
      bubbles: true,
    })
  );
}
