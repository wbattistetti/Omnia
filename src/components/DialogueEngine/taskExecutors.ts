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
    onGetRetrieveEvent?: (nodeId: string, ddt?: AssembledDDT) => Promise<any>;
    onProcessInput?: (input: string, node: any) => Promise<{ status: 'match' | 'noMatch' | 'noInput' | 'partialMatch'; value?: any }>;
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
        console.log('[TaskExecutor][executeTask] Calling executeSayMessage', {
          taskId: task.id,
          taskStateBefore: task.state
        });
        const result = await executeSayMessage(task, callbacks);
        console.log('[TaskExecutor][executeTask] executeSayMessage returned', {
          taskId: task.id,
          taskStateAfter: task.state,
          resultSuccess: result.success
        });
        return result;

      case 'GetData':
        return await executeGetData(task, {
          onMessage: callbacks.onMessage,
          onDDTStart: callbacks.onDDTStart,
          onGetRetrieveEvent: callbacks.onGetRetrieveEvent,
          onProcessInput: callbacks.onProcessInput
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
  console.log('[TaskExecutor][executeSayMessage] Starting', {
    taskId: task.id,
    taskState: task.state,
    hasValue: !!task.value,
    hasText: !!task.value?.text
  });

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
  console.log('[TaskExecutor][executeSayMessage] About to call onMessage', {
    taskId: task.id,
    hasOnMessage: !!callbacks.onMessage,
    textLength: text.length
  });

  if (callbacks.onMessage) {
    try {
      console.log('[TaskExecutor][executeSayMessage] Calling onMessage callback', {
        taskId: task.id,
        textLength: text.length
      });
      callbacks.onMessage(text);
      console.log('[TaskExecutor][executeSayMessage] onMessage callback completed', {
        taskId: task.id,
        taskState: task.state
      });
    } catch (error) {
      console.error('[TaskExecutor][executeSayMessage] Error in onMessage callback', {
        taskId: task.id,
        error: error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined
      });
      // Don't throw - continue execution and mark task as Executed anyway
      // The error is in the UI callback, not in the task execution itself
      console.warn('[TaskExecutor][executeSayMessage] Continuing despite onMessage error');
    }
  } else {
    console.log('[TaskExecutor][executeSayMessage] No onMessage callback provided');
  }

  console.log('[TaskExecutor][executeSayMessage] After onMessage call', {
    taskId: task.id,
    taskState: task.state,
    taskStateDirect: task.state,
    taskStateCheck: task.state === 'Executed' ? 'YES' : 'NO'
  });

  // Check if this message is inside a GetData or ClassifyProblem row recovery
  // If so, mark as interactive (WaitingUserInput) instead of Executed
  const parentRowAction = task.source?.parentRowAction;
  const isInteractiveRow = parentRowAction === 'GetData' || parentRowAction === 'ClassifyProblem';
  const isRecoveryAction = task.source?.type === 'ddt-recovery-action';

  console.log('[TaskExecutor][executeSayMessage] Checking task source', {
    taskId: task.id,
    hasSource: !!task.source,
    sourceType: task.source?.type,
    parentRowAction,
    isInteractiveRow,
    isRecoveryAction
  });

  if (isInteractiveRow && isRecoveryAction) {
    // Message inside GetData/ClassifyProblem row recovery is interactive
    task.state = 'WaitingUserInput';
    console.log('[TaskExecutor][executeSayMessage] Message marked as interactive', {
      taskId: task.id,
      parentRowAction,
      isRecoveryAction,
      taskState: task.state
    });
  } else {
    // Regular message: mark as Executed
    // TODO: If task has duration (e.g., audio), wait for completion
    task.state = 'Executed';
    console.log('[TaskExecutor][executeSayMessage] Message marked as Executed', {
      taskId: task.id,
      taskState: task.state,
      isInteractiveRow,
      isRecoveryAction,
      taskStateDirect: task.state,
      taskObject: { id: task.id, state: task.state }
    });
  }

  // Double-check state before returning
  console.log('[TaskExecutor][executeSayMessage] Final check before return', {
    taskId: task.id,
    finalState: task.state,
    taskStateProperty: task.state
  });

  return {
    success: true,
    variables: {}
  };
}

/**
 * Execute GetData task using hierarchical DDT navigation
 * Uses native hierarchical navigation instead of flat task structure
 * Marks task as WaitingUserInput during retrieval, Executed when complete
 */
async function executeGetData(
  task: CompiledTask,
  callbacks: {
    onMessage?: (text: string) => void;
    onDDTStart?: (ddt: AssembledDDT) => void;
    onGetRetrieveEvent?: (nodeId: string, ddt?: AssembledDDT) => Promise<any>;
    onProcessInput?: (input: string, node: any) => Promise<any>;
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

  // Log DDT structure for debugging
  if (ddt) {
    console.log('[TaskExecutor][executeGetData] DDT structure', {
      ddtId: ddt.id,
      ddtLabel: ddt.label,
      ddtKeys: Object.keys(ddt),
      hasMainData: !!ddt.mainData,
      mainDataType: typeof ddt.mainData,
      isMainDataArray: Array.isArray(ddt.mainData),
      hasNodes: !!(ddt as any).nodes,
      nodesCount: (ddt as any).nodes?.length || 0,
      mainDataValue: ddt.mainData ? (Array.isArray(ddt.mainData) ? ddt.mainData[0] : ddt.mainData) : null
    });
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

  // Use hierarchical DDT navigation
  try {
    const { executeGetDataHierarchical } = await import('./ddt');

    // Initialize DDT state
    const ddtState = {
      memory: {} as Record<string, { value: any; confirmed: boolean }>,
      noMatchCounters: {} as Record<string, number>,
      noInputCounters: {} as Record<string, number>,
      notConfirmedCounters: {} as Record<string, number>
    };

    // Mark as WaitingUserInput (will be updated during navigation)
    task.state = 'WaitingUserInput';

    // Execute hierarchical navigation
    // Pass DDT to callbacks so they can access it
    const ddtCallbacks = {
      onMessage: callbacks.onMessage,
      onGetRetrieveEvent: callbacks.onGetRetrieveEvent ?
        (nodeId: string, ddtParam?: AssembledDDT) => callbacks.onGetRetrieveEvent!(nodeId, ddtParam || ddt) :
        undefined,
      onProcessInput: callbacks.onProcessInput,
      translations: (ddt as any).translations || {} // Pass DDT translations
    };

    const result = await executeGetDataHierarchical(
      ddt,
      ddtState,
      ddtCallbacks
    );

    if (result.exit) {
      // Exit action triggered
      return {
        success: false,
        error: new Error('DDT execution exited'),
        retrievalState: 'empty'
      };
    }

    if (result.success) {
      // All mainData completed - mark as Executed
      task.state = 'Executed';
      return {
        success: true,
        variables: ddtState.memory,
        retrievalState: 'saturated',
        ddt
      };
    }

    // Error during navigation
    return {
      success: false,
      error: result.error || new Error('DDT navigation failed'),
      retrievalState: 'empty'
    };

  } catch (error) {
    console.error('[TaskExecutor][executeGetData] Error in hierarchical navigation', error);
    // Fallback to old behavior if new navigation fails
    task.state = 'WaitingUserInput';
    return {
      success: true,
      ddt,
      retrievalState: 'empty'
    };
  }
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
  _callbacks: { onMessage?: (text: string) => void }
): Promise<TaskExecutionResult> {
  // AI Agent execution would go here
  // For now, just return success
  task.state = 'Executed';
  return {
    success: true,
    variables: {}
  };
}

