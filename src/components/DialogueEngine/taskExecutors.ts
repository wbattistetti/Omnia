// Task Executors: Execute different types of tasks

import type { CompiledTask } from '../FlowCompiler/types';
import type { AssembledDDT } from '../DialogueDataTemplateBuilder/DDTAssembler/currentDDT.types';

export interface TaskExecutionResult {
  success: boolean;
  variables?: Record<string, any>;
  retrievalState?: 'empty' | 'asrNoMatch' | 'asrNoInput' | 'saturated' | 'confirmed';
  ddt?: AssembledDDT;
  error?: Error;
}

/**
 * Normalizes action ID to action type
 * Handles cases where action is an item ID (e.g., "item_...") instead of standard type
 */
function normalizeActionType(action: string, value?: Record<string, any>): string {
  // If already a standard action type, return as-is
  const standardTypes = ['SayMessage', 'Message', 'GetData', 'ClassifyProblem', 'ProblemClassification', 'callBackend', 'BackendCall', 'AIAgent'];
  if (standardTypes.includes(action)) {
    return action;
  }

  // Infer from value structure
  // IMPORTANT: Check DDT first, as GetData tasks can have both text and ddt
  if (value) {
    console.log('[TaskExecutor][normalizeActionType] Checking value structure', {
      action,
      hasDDT: value.ddt !== undefined,
      hasText: value.text !== undefined,
      hasIntents: value.intents !== undefined,
      hasProblem: value.problem !== undefined,
      hasConfig: value.config !== undefined,
      hasEndpoint: value.endpoint !== undefined,
      valueKeys: Object.keys(value)
    });
    if (value.ddt !== undefined) {
      console.log('[TaskExecutor][normalizeActionType] Inferred as GetData (has DDT)');
      return 'GetData';
    }
    if (value.text !== undefined) {
      console.log('[TaskExecutor][normalizeActionType] Inferred as SayMessage (has text)');
      return 'SayMessage';
    }
    if (value.intents !== undefined || value.problem !== undefined) {
      return 'ClassifyProblem';
    }
    if (value.config !== undefined || value.endpoint !== undefined) {
      return 'BackendCall';
    }
  }

  // If action starts with "item_", try to infer from common patterns
  if (action.startsWith('item_')) {
    // Default to Message for item IDs (most common case)
    console.warn(`[TaskExecutor] Action is item ID (${action}), inferring as Message. Consider setting explicit action type.`);
    return 'SayMessage';
  }

  return action;
}

/**
 * Executes a compiled task based on its action type
 */
export async function executeTask(
  task: CompiledTask,
  callbacks: {
    onMessage?: (text: string) => void;
    onDDTStart?: (ddt: AssembledDDT) => void;
    onBackendCall?: (config: any) => Promise<any>;
    onProblemClassify?: (intents: any[], ddt: AssembledDDT) => Promise<any>;
  }
): Promise<TaskExecutionResult> {
  console.log('[TaskExecutor][executeTask] Starting', {
    taskId: task.id,
    action: task.action,
    normalizedAction: normalizeActionType(task.action, task.value),
    hasValue: !!task.value,
    valueKeys: task.value ? Object.keys(task.value) : []
  });
  try {
    // Normalize action type (handle item IDs, etc.)
    const normalizedAction = normalizeActionType(task.action, task.value);
    console.log('[TaskExecutor][executeTask] Action normalized', {
      original: task.action,
      normalized: normalizedAction
    });

    switch (normalizedAction) {
      case 'SayMessage':
      case 'Message':
        return await executeSayMessage(task, callbacks);

      case 'GetData':
        return await executeGetData(task, {
          onMessage: callbacks.onMessage,
          onDDTStart: callbacks.onDDTStart
        });

      case 'ClassifyProblem':
      case 'ProblemClassification':
        return await executeClassifyProblem(task, callbacks);

      case 'callBackend':
      case 'BackendCall':
        return await executeBackendCall(task, callbacks);

      case 'AIAgent':
        return await executeAIAgent(task, callbacks);

      default:
        console.warn(`[TaskExecutor] Unknown action type: ${task.action} (normalized: ${normalizedAction})`);
        return { success: false, error: new Error(`Unknown action: ${task.action}`) };
    }
  } catch (error) {
    return {
      success: false,
      error: error as Error
    };
  }
}

/**
 * Execute SayMessage task
 * Marks task as Executed immediately (or after duration if audio/async)
 */
async function executeSayMessage(
  task: CompiledTask,
  callbacks: { onMessage?: (text: string) => void }
): Promise<TaskExecutionResult> {
  // Get text from task.value.text
  const text = task.value?.text || '';

  if (!text) {
    console.warn('[TaskExecutor] SayMessage task has no text', { taskId: task.id, task });
    return {
      success: false,
      error: new Error('SayMessage task missing text')
    };
  }

  // Show message
  if (callbacks.onMessage) {
    callbacks.onMessage(text);
  }

  // Check if this message is inside a GetData or ClassifyProblem row recovery
  // If so, mark as interactive (WaitingUserInput) instead of Executed
  const parentRowAction = task.source?.parentRowAction;
  const isInteractiveRow = parentRowAction === 'GetData' || parentRowAction === 'ClassifyProblem';
  const isRecoveryAction = task.source?.type === 'ddt-recovery-action';

  if (isInteractiveRow && isRecoveryAction) {
    // Message inside GetData/ClassifyProblem row recovery is interactive
    task.state = 'WaitingUserInput';
    console.log('[TaskExecutor][executeSayMessage] Message marked as interactive', {
      taskId: task.id,
      parentRowAction,
      isRecoveryAction
    });
  } else {
    // Regular message: mark as Executed
    // TODO: If task has duration (e.g., audio), wait for completion
    task.state = 'Executed';
  }

  return {
    success: true,
    variables: {}
  };
}

/**
 * Execute GetData task (starts DDT)
 * GetData tasks can have both text (message to show) and ddt (DDT to open)
 * Marks task as WaitingUserInput (suspensive condition)
 * If task has no text, extracts initial message from DDT (step "start")
 */
async function executeGetData(
  task: CompiledTask,
  callbacks: {
    onMessage?: (text: string) => void;
    onDDTStart?: (ddt: AssembledDDT) => void;
  }
): Promise<TaskExecutionResult> {
  console.log('[TaskExecutor][executeGetData] Starting', {
    taskId: task.id,
    hasValue: !!task.value,
    valueKeys: task.value ? Object.keys(task.value) : [],
    hasText: !!task.value?.text,
    text: task.value?.text,
    hasDDT: !!task.value?.ddt,
    hasOnMessage: !!callbacks.onMessage,
    hasOnDDTStart: !!callbacks.onDDTStart
  });

  const ddt = task.value?.ddt;
  let text = task.value?.text;

  // If task has no text, try to extract initial message from DDT (step "start")
  if (!text && ddt) {
    console.log('[TaskExecutor][executeGetData] Task has no text, extracting from DDT');
    try {
      // Import resolveAsk dynamically to avoid circular dependencies
      const { resolveAsk } = await import('../ChatSimulator/messageResolvers');

      // Get main data from DDT
      const mainData = Array.isArray(ddt.mainData) ? ddt.mainData[0] : ddt.mainData;
      if (mainData) {
        // Try to get legacy node structure for resolveAsk
        const legacyMain = (ddt as any).legacyMain || mainData;

        // Resolve initial message from DDT (step "start")
        const resolved = resolveAsk(undefined, undefined, undefined, undefined, legacyMain, undefined);
        if (resolved.text) {
          text = resolved.text;
          console.log('[TaskExecutor][executeGetData] Extracted message from DDT', {
            text: text.substring(0, 100),
            stepType: resolved.stepType
          });
        } else {
          console.warn('[TaskExecutor][executeGetData] Could not extract message from DDT', {
            hasMainData: !!mainData,
            mainDataKind: mainData.kind,
            hasSteps: !!mainData.steps,
            stepsKeys: mainData.steps ? Object.keys(mainData.steps) : []
          });
        }
      }
    } catch (error) {
      console.error('[TaskExecutor][executeGetData] Error extracting message from DDT', error);
    }
  }

  // If we have text (from task.value or extracted from DDT), show message first
  if (text) {
    console.log('[TaskExecutor][executeGetData] Showing message', { text: text.substring(0, 100) });
    if (callbacks.onMessage) {
      callbacks.onMessage(text);
      console.log('[TaskExecutor][executeGetData] Message callback called');
    } else {
      console.warn('[TaskExecutor][executeGetData] Task has text but onMessage callback is not provided');
    }
  } else {
    console.log('[TaskExecutor][executeGetData] No message to show (no text in task.value and could not extract from DDT)');
  }

  if (!ddt) {
    console.error('[TaskExecutor][executeGetData] GetData task missing DDT', {
      taskId: task.id,
      value: task.value
    });
    return {
      success: false,
      error: new Error('GetData task missing DDT')
    };
  }

  // Start DDT (interactive - waits for user input)
  console.log('[TaskExecutor][executeGetData] Starting DDT', {
    hasOnDDTStart: !!callbacks.onDDTStart,
    ddtKeys: ddt ? Object.keys(ddt) : []
  });
  if (callbacks.onDDTStart) {
    callbacks.onDDTStart(ddt);
    console.log('[TaskExecutor][executeGetData] DDT callback called');
  } else {
    console.warn('[TaskExecutor][executeGetData] DDT callback is not provided');
  }

  // Mark as WaitingUserInput (suspensive condition - engine will stop)
  task.state = 'WaitingUserInput';
  console.log('[TaskExecutor][executeGetData] Task marked as WaitingUserInput', {
    taskId: task.id,
    state: task.state
  });

  return {
    success: true,
    ddt,
    retrievalState: 'empty' // DDT starts in empty state
  };
}

/**
 * Execute ClassifyProblem task
 * Marks task as Executed after completion
 */
async function executeClassifyProblem(
  task: CompiledTask,
  callbacks: { onProblemClassify?: (intents: any[], ddt: AssembledDDT) => Promise<any> }
): Promise<TaskExecutionResult> {
  const intents = task.value?.intents || [];
  const ddt = task.value?.ddt;

  if (!ddt) {
    return {
      success: false,
      error: new Error('ClassifyProblem task missing DDT')
    };
  }

  if (callbacks.onProblemClassify) {
    const result = await callbacks.onProblemClassify(intents, ddt);
    task.state = 'Executed';
    return {
      success: true,
      variables: result.variables || {},
      retrievalState: result.retrievalState || 'saturated'
    };
  }

  task.state = 'Executed';
  return {
    success: true,
    retrievalState: 'saturated'
  };
}

/**
 * Execute BackendCall task
 * Marks task as Executed after backend call completes
 */
async function executeBackendCall(
  task: CompiledTask,
  callbacks: { onBackendCall?: (config: any) => Promise<any> }
): Promise<TaskExecutionResult> {
  const config = task.value?.config || task.value;

  if (!callbacks.onBackendCall) {
    return {
      success: false,
      error: new Error('BackendCall callback not provided')
    };
  }

  const result = await callbacks.onBackendCall(config);
  task.state = 'Executed';

  return {
    success: true,
    variables: result.variables || result || {}
  };
}

/**
 * Execute AIAgent task
 * Marks task as Executed after completion
 */
async function executeAIAgent(
  task: CompiledTask,
  callbacks: { onMessage?: (text: string) => void }
): Promise<TaskExecutionResult> {
  // AI Agent execution would go here
  // For now, just return success
  task.state = 'Executed';
  return {
    success: true,
    variables: {}
  };
}

