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
    translations?: Record<string, string>; // ✅ Translations from global table
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
        // 🔍 DEBUG: Log translations being passed to executeGetData
        console.log('[TaskExecutor][executeTask] 🔍 Passing translations to executeGetData', {
          hasTranslations: !!callbacks.translations,
          translationsCount: callbacks.translations ? Object.keys(callbacks.translations).length : 0,
          sampleTranslationKeys: callbacks.translations ? Object.keys(callbacks.translations).slice(0, 5) : [],
          sampleTranslations: callbacks.translations ? Object.entries(callbacks.translations).slice(0, 3).map(([k, v]) => ({
            key: k,
            value: String(v).substring(0, 50)
          })) : [],
          taskId: task.id,
          taskAction: task.action
        });
        return await executeGetData(task, {
          onMessage: callbacks.onMessage,
          onDDTStart: callbacks.onDDTStart,
          onGetRetrieveEvent: callbacks.onGetRetrieveEvent,
          onProcessInput: callbacks.onProcessInput,
          translations: callbacks.translations // ✅ Pass translations from callbacks
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
    translations?: Record<string, string>; // ✅ Translations from global table
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

  // ❌ REMOVED: Don't extract or show initial message here
  // The DDT navigator will handle the "start" step and show the message correctly
  // This was causing duplicate messages (GUID first, then translated)
  // The DDT navigator executes the step "start" which already shows the message

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

  // Use DialogueDataEngine (same as ResponseEditor chat simulator)
  try {
    // Import DialogueDataEngine modules
    const { adaptCurrentToV2 } = await import('../DialogueDataEngine/model/adapters/currentToV2');
    const { initEngine, advance } = await import('../DialogueDataEngine/engine');
    const { getMain, getSub } = await import('../ActEditor/ResponseEditor/ChatSimulator/messageResolvers');
    const { resolveAsk, resolveConfirm, resolveSuccess } = await import('../ActEditor/ResponseEditor/ChatSimulator/messageResolvers');
    const { getEscalationActions } = await import('../ActEditor/ResponseEditor/ChatSimulator/DDTAdapter');
    const { resolveActionText } = await import('../ActEditor/ResponseEditor/ChatSimulator/DDTAdapter');

    // Get project language for adaptation
    let projectLanguage: string;
    try {
      const lang = localStorage.getItem('project.lang');
      if (!lang) throw new Error('project.lang not found');
      projectLanguage = lang;
    } catch (err) {
      console.error('[TaskExecutor][executeGetData] Failed to get project language:', err);
      projectLanguage = 'it'; // Fallback
    }

    // Adapt DDT to V2 format
    const template = await adaptCurrentToV2(ddt, projectLanguage);
    console.log('[TaskExecutor][executeGetData] DDT adapted to V2', {
      templateNodesCount: template.nodes.length,
      templateId: template.id
    });

    // Initialize engine state
    let engineState = initEngine(template);

    // Mark as WaitingUserInput
    task.state = 'WaitingUserInput';

    // Helper to show messages based on engine state
    const showMessageFromState = (state: any) => {
      const main = getMain(state);
      const sub = getSub(state);
      const mainNodeState = main ? state.nodeStates[main.id] : undefined;
      const step = mainNodeState?.step || 'Start';
      const counter = mainNodeState?.counters || { noMatch: 0, noInput: 0, confirmation: 0, notConfirmed: 0 };

      // Get legacy node for message resolution
      const legacyMain = Array.isArray((ddt as any)?.mainData)
        ? (ddt as any).mainData[0]
        : (ddt as any)?.mainData;
      const legacySub = sub && legacyMain?.subData
        ? legacyMain.subData.find((s: any) => (s?.id === sub.id) || (String(s?.label || '').toLowerCase() === String(sub?.label || '').toLowerCase()))
        : undefined;

      const mergedTranslations = callbacks.translations || {};
      const legacyDict = {}; // Empty legacy dict, use only translations

      let messageText: string | undefined;
      let escalationLevel: number | undefined;

      if (state.mode === 'CollectingMain' || state.mode === 'CollectingSub') {
        if (step === 'NoMatch') {
          // Show escalation for noMatch
          escalationLevel = Math.min(3, counter.noMatch);
          if (legacyMain || legacySub) {
            const targetNode = legacySub || legacyMain;
            const actions = getEscalationActions(targetNode, 'noMatch', escalationLevel);
            if (actions.length > 0) {
              messageText = resolveActionText(actions[0], mergedTranslations);
            }
          }
          if (!messageText && main) {
            const reask = (sub || main)?.steps?.ask?.reaskNoMatch || [];
            const key = reask[Math.min(escalationLevel - 1, reask.length - 1)] || reask[0];
            messageText = key ? (mergedTranslations[key] || key) : '';
          }
        } else if (step === 'NoInput') {
          // Show escalation for noInput
          escalationLevel = Math.min(3, counter.noInput);
          if (legacyMain || legacySub) {
            const targetNode = legacySub || legacyMain;
            const actions = getEscalationActions(targetNode, 'noInput', escalationLevel);
            if (actions.length > 0) {
              messageText = resolveActionText(actions[0], mergedTranslations);
            }
          }
          if (!messageText && main) {
            const reask = (sub || main)?.steps?.ask?.reaskNoInput || [];
            const key = reask[Math.min(escalationLevel - 1, reask.length - 1)] || reask[0];
            messageText = key ? (mergedTranslations[key] || key) : '';
          }
        } else {
          // Show normal ask
          const { text } = resolveAsk(main, sub, mergedTranslations, legacyDict, legacyMain, legacySub);
          messageText = text;
        }
      } else if (state.mode === 'ConfirmingMain') {
        if (step === 'NotConfirmed') {
          // Show notConfirmed escalation
          escalationLevel = Math.min(3, counter.notConfirmed);
          if (legacyMain) {
            const actions = getEscalationActions(legacyMain, 'confirmation', escalationLevel);
            if (actions.length > 0) {
              messageText = resolveActionText(actions[0], mergedTranslations);
            }
          }
          if (!messageText && main) {
            const reask = main?.steps?.confirm?.noMatch || [];
            const key = reask[Math.min(escalationLevel - 1, reask.length - 1)] || reask[0];
            messageText = key ? (mergedTranslations[key] || key) : '';
          }
        } else {
          // Show confirmation
          const { text } = resolveConfirm(state, main, legacyDict, legacyMain, mergedTranslations);
          messageText = text;
        }
      } else if (state.mode === 'SuccessMain') {
        // Show success
        const { text } = resolveSuccess(main, mergedTranslations, legacyDict, legacyMain);
        messageText = text;
      }

      if (messageText && callbacks.onMessage) {
        callbacks.onMessage(messageText, step.toLowerCase(), escalationLevel);
      }
    };

    // Show initial message
    showMessageFromState(engineState);

    // Main loop: wait for user input and process
    while (true) {
      const main = getMain(engineState);
      if (!main) {
        // All done
        task.state = 'Executed';
        const variables: Record<string, any> = {};
        Object.entries(engineState.memory).forEach(([key, mem]: [string, any]) => {
          if (mem.confirmed) {
            variables[key] = mem.value;
          }
        });
        return {
          success: true,
          variables,
          retrievalState: 'saturated',
          ddt
        };
      }

      // Wait for user input
      if (!callbacks.onGetRetrieveEvent) {
        return {
          success: false,
          error: new Error('onGetRetrieveEvent callback not provided'),
          retrievalState: 'empty'
        };
      }

      const userInput = await callbacks.onGetRetrieveEvent(main.id, ddt);

      if (userInput === null || userInput === undefined) {
        // No input - will be handled by advance() as empty string
        engineState = advance(engineState, '');
      } else if (typeof userInput === 'string') {
        // Process input if callback provided
        let extractedVars: Record<string, any> | undefined;
        if (callbacks.onProcessInput) {
          const processResult = await callbacks.onProcessInput(userInput, main);
          if (processResult.status === 'match' && processResult.value) {
            extractedVars = { value: processResult.value };
          } else if (processResult.status === 'partialMatch' && processResult.value) {
            extractedVars = processResult.value;
          }
        }
        engineState = advance(engineState, userInput, extractedVars);
      } else {
        // Event object
        if (userInput.type === 'exit') {
          return {
            success: false,
            error: new Error('DDT execution exited'),
            retrievalState: 'empty'
          };
        }
        const inputStr = userInput.type === 'match' ? String(userInput.value || '') : '';
        engineState = advance(engineState, inputStr);
      }

      // Show messages from new state
      showMessageFromState(engineState);

      // Check if completed
      if (engineState.mode === 'Completed') {
        task.state = 'Executed';
        const variables: Record<string, any> = {};
        Object.entries(engineState.memory).forEach(([key, mem]: [string, any]) => {
          if (mem.confirmed) {
            variables[key] = mem.value;
          }
        });
        return {
          success: true,
          variables,
          retrievalState: 'saturated',
          ddt
        };
      }
    }

  } catch (error) {
    console.error('[TaskExecutor][executeGetData] Error in DialogueDataEngine', error);
    task.state = 'WaitingUserInput';
    return {
      success: false,
      error: error instanceof Error ? error : new Error('DDT execution failed'),
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

