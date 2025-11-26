// Task Executors: Execute different types of tasks

import type { CompiledTask } from '../FlowCompiler/types';
import type { AssembledDDT } from '../DialogueDataTemplateBuilder/DDTAssembler/currentDDT.types';
import { taskRepository } from '../../services/TaskRepository';

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
    onUserInputProcessed?: (input: string, matchStatus: 'match' | 'noMatch' | 'partialMatch', extractedValues?: any[]) => void;
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
          onUserInputProcessed: callbacks.onUserInputProcessed,
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
    onUserInputProcessed?: (input: string, matchStatus: 'match' | 'noMatch' | 'partialMatch', extractedValues?: any[]) => void;
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

  // ✅ Extract variables from DDT structure to create mappings (BEFORE execution)
  // This ensures FlowchartVariablesService has the mappings needed for condition evaluation
  // Do this early so mappings are available when conditions are evaluated
  if (ddt) {
    try {
      const { flowchartVariablesService } = await import('../../services/FlowchartVariablesService');
      const projectId = (window as any).__currentProjectId || (window as any).__projectId;
      if (projectId) {
        await flowchartVariablesService.init(projectId);

        // Get row text from task (this is the label of the row)
        const originalTask = taskRepository.getTask(task.id);
        const rowText = originalTask?.value?.text || task.value?.text || task.source?.rowText || task.source?.label || 'Task';

        // Extract variables from DDT using row text and DDT labels
        const varNames = await flowchartVariablesService.extractVariablesFromDDT(
          ddt,
          task.id, // taskId
          task.id, // rowId (same as taskId)
          rowText, // Row text (e.g., "chiedi data A")
          task.source?.nodeId // nodeId
        );

        console.log('[TaskExecutor][executeGetData] ✅ Extracted variables from DDT (before execution)', {
          taskId: task.id,
          rowText,
          varCount: varNames.length,
          varNames: varNames.slice(0, 10)
        });
      }
    } catch (e) {
      console.warn('[TaskExecutor][executeGetData] ⚠️ Failed to extract variables from DDT', e);
    }
  }

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

  // ✅ Use executeGetDataHierarchical (supports toggle between old/new engine)
  // Check if we should use new engine from localStorage
  const useNewEngine = (() => {
    try {
      return localStorage.getItem('ddt.useNewEngine') === 'true';
    } catch {
      return false;
    }
  })();

  console.log('[TaskExecutor][executeGetData] ═══════════════════════════════════════════════════════');
  console.log('[TaskExecutor][executeGetData] 🔍 Checking which engine to use', {
    useNewEngine,
    fromStorage: (() => {
      try {
        return localStorage.getItem('ddt.useNewEngine');
      } catch {
        return 'N/A';
      }
    })(),
    timestamp: new Date().toISOString()
  });
  console.log('[TaskExecutor][executeGetData] ═══════════════════════════════════════════════════════');

  if (useNewEngine) {
    // ✅ Use new hierarchical navigator (supports new engine via toggle)
    console.log('[TaskExecutor][executeGetData] 🆕 Using executeGetDataHierarchical (supports NEW engine)');
    try {
      const { executeGetDataHierarchical } = await import('./ddt/ddtNavigator');

      // Initialize DDTState
      const ddtState = {
        memory: {},
        noMatchCounters: {},
        noInputCounters: {},
        notConfirmedCounters: {}
      };

      // Create callbacks compatible with DDTNavigatorCallbacks
      const navigatorCallbacks = {
        onMessage: callbacks.onMessage,
        onGetRetrieveEvent: async (nodeId: string, ddtParam?: AssembledDDT) => {
          if (callbacks.onGetRetrieveEvent) {
            // Use ddtParam if provided, otherwise use ddt from closure
            return await callbacks.onGetRetrieveEvent(nodeId, ddtParam || ddt);
          }
          throw new Error('onGetRetrieveEvent not provided');
        },
        onProcessInput: callbacks.onProcessInput,
        translations: callbacks.translations
      };

      console.log('[TaskExecutor][executeGetData] 🆕 Calling executeGetDataHierarchical', {
        useNewEngine,
        willUseNew: useNewEngine
      });

      // Call hierarchical navigator (will use new/old engine based on toggle)
      // Pass useNewEngine from toggle to ensure it's respected
      const result = await executeGetDataHierarchical(
        ddt,
        ddtState,
        navigatorCallbacks,
        { useNewEngine } // Use toggle value
      );

      console.log('[TaskExecutor][executeGetData] ✅ executeGetDataHierarchical completed', {
        success: result.success,
        hasValue: !!result.value,
        hasError: !!result.error
      });

      if (result.success) {
        task.state = 'Executed';
        // Extract variables from result.value (new engine) or ddtState.memory (old engine)
        const variables: Record<string, any> = {};

        if (result.value && typeof result.value === 'object') {
          // New engine returns data in result.value with GUID keys
          // Convert GUID keys to readable names using FlowchartVariablesService
          console.log('[TaskExecutor][executeGetData] 🔍 BEFORE conversion', {
            resultValueKeys: Object.keys(result.value),
            resultValueSample: Object.entries(result.value).slice(0, 3).map(([k, v]) => ({
              key: k.substring(0, 20) + '...',
              value: v
            }))
          });

          try {
            const { flowchartVariablesService } = await import('../../services/FlowchartVariablesService');
            // Try multiple sources for projectId (same as TaskRepository)
            let projectId: string | undefined = undefined;
            if (typeof window !== 'undefined') {
              // Try localStorage first (most reliable)
              projectId = localStorage.getItem('current.projectId') || localStorage.getItem('currentProjectId') || undefined;
              // Fallback to runtime state
              if (!projectId) {
                try {
                  const { getCurrentProjectId } = await import('../../state/runtime');
                  projectId = getCurrentProjectId() || undefined;
                } catch (e) {
                  // runtime module not available
                }
              }
              // Last resort: window object
              if (!projectId) {
                projectId = (window as any).__currentProjectId || (window as any).__projectId || (window as any).currentProjectId;
              }
            }
            console.log('[TaskExecutor][executeGetData] 🔍 Service init', { projectId, hasService: !!flowchartVariablesService });

            if (projectId) {
              await flowchartVariablesService.init(projectId);

              // Convert each GUID key to readable name
              // IMPORTANT: Add BOTH GUID and readable name (like old engine does)
              // This ensures conditions work with both key types
              const conversionResults: Array<{ guid: string; readableName: string | null; value: any }> = [];
              Object.entries(result.value).forEach(([guidKey, value]) => {
                // STEP 1: Always add GUID key first (for internal engine)
                variables[guidKey] = value;

                // STEP 2: Add readable name as additional key (for conditions/scripts)
                const readableName = flowchartVariablesService.getReadableName(guidKey);
                conversionResults.push({
                  guid: guidKey.substring(0, 20) + '...',
                  readableName,
                  value: typeof value === 'object' ? 'object' : value
                });
                if (readableName) {
                  variables[readableName] = value; // Add as additional key, not replacement
                }
              });

              const guidKeys = Object.keys(variables).filter(k => k.length === 36 && k.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i));
              const labelKeys = Object.keys(variables).filter(k => !guidKeys.includes(k));

              console.log('[TaskExecutor][executeGetData] ✅ Variables from NEW engine (enriched with readable names)', {
                variablesCount: Object.keys(variables).length,
                guidKeysCount: guidKeys.length,
                labelKeysCount: labelKeys.length,
                readableNames: labelKeys.slice(0, 5),
                conversionResults: conversionResults.slice(0, 10),
                allVariableKeys: Object.keys(variables)
              });
            } else {
              console.warn('[TaskExecutor][executeGetData] ⚠️ No projectId, using GUID keys directly');
              // No projectId: use GUID keys directly
              Object.entries(result.value).forEach(([key, value]) => {
                variables[key] = value;
              });
            }
          } catch (e) {
            console.error('[TaskExecutor][executeGetData] ❌ Error converting GUID to readable names', e);
            // Fallback: use GUID keys directly
            Object.entries(result.value).forEach(([key, value]) => {
              variables[key] = value;
            });
          }
        } else {
          // Fallback: extract from ddtState.memory (old engine format)
          Object.entries(ddtState.memory).forEach(([key, mem]) => {
            if (mem.confirmed) {
              variables[key] = mem.value;
            }
          });
          console.log('[TaskExecutor][executeGetData] ✅ Variables from ddtState.memory (fallback)', {
            variablesCount: Object.keys(variables).length
          });
        }

        return {
          success: true,
          variables
        };
      } else {
        task.state = 'WaitingUserInput';
        return {
          success: false,
          error: result.error || new Error('DDT execution failed'),
          retrievalState: 'empty'
        };
      }
    } catch (error) {
      console.error('[TaskExecutor][executeGetData] Error in new hierarchical navigator', error);
      task.state = 'WaitingUserInput';
      return {
        success: false,
        error: error instanceof Error ? error : new Error('DDT execution failed'),
        retrievalState: 'empty'
      };
    }
  }

  // Fallback: Use DialogueDataEngine V2 (old engine)
  console.log('[TaskExecutor][executeGetData] 🔧 Using DialogueDataEngine V2 (OLD engine)');
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
            console.log('[TaskExecutor][executeGetData] ✅ Adding variable to result (no main)', {
              guid: key.substring(0, 20) + '...',
              value: mem.value,
              confirmed: mem.confirmed
            });
          }
        });
        console.log('[TaskExecutor][executeGetData] 📊 Variables built from memory (no main)', {
          variablesCount: Object.keys(variables).length,
          variableKeys: Object.keys(variables).map(k => k.substring(0, 20) + '...'),
          variables
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
        // Process input if callback provided BEFORE calling advance()
        // This allows us to extract values and pass them to onUserInputProcessed
        let extractedVars: Record<string, any> | undefined;
        let extractedValues: any[] | undefined = undefined;
        let matchStatus: 'match' | 'noMatch' | 'partialMatch' = 'noMatch';

        if (callbacks.onProcessInput) {
          console.log('[TaskExecutor][executeGetData] Processing input', { userInput, hasOnUserInputProcessed: !!callbacks.onUserInputProcessed });
          const processResult = await callbacks.onProcessInput(userInput, main);
          console.log('[TaskExecutor][executeGetData] Process result', {
            status: processResult.status,
            hasValue: !!processResult.value,
            valueKeys: processResult.value ? Object.keys(processResult.value) : []
          });

          matchStatus = processResult.status === 'partialMatch' ? 'match' : processResult.status;

          if (processResult.status === 'match' && processResult.value) {
            // ✅ CRITICAL: Contract ritorna { day: 12, month: 2, year: 1980 }
            // advance() si aspetta questo formato direttamente, NON wrappato in { value: ... }
            extractedVars = processResult.value;
            console.log('[TaskExecutor][executeGetData] ✅ Using extracted values directly from Contract', {
              extractedVars,
              valuesCount: Object.keys(extractedVars).length
            });

            // Convert extracted value to ExtractedValue[] format for display (simple, no nested value)
            extractedValues = Object.entries(processResult.value)
              .filter(([key, val]) => val !== undefined && val !== null)
              .map(([key, val]) => ({
                variable: key,
                linguisticValue: undefined, // Will be filled by useNewFlowOrchestrator
                semanticValue: val
              }));
            console.log('[TaskExecutor][executeGetData] Converted extracted values for display', {
              extractedValuesCount: extractedValues.length,
              extractedValues
            });
          } else if (processResult.status === 'partialMatch' && processResult.value) {
            // ✅ CRITICAL: For partialMatch, also pass directly
            extractedVars = processResult.value;
            console.log('[TaskExecutor][executeGetData] ✅ Using extracted values (partialMatch)', {
              extractedVars,
              valuesCount: Object.keys(extractedVars).length
            });

            // Convert extracted value to ExtractedValue[] format for display (simple, no nested value)
            extractedValues = Object.entries(processResult.value)
              .filter(([key, val]) => val !== undefined && val !== null)
              .map(([key, val]) => ({
                variable: key,
                linguisticValue: undefined, // Will be filled by useNewFlowOrchestrator
                semanticValue: val
              }));
            console.log('[TaskExecutor][executeGetData] Converted extracted values for display (partialMatch)', {
              extractedValuesCount: extractedValues.length,
              extractedValues
            });
          }

          // Call onUserInputProcessed callback if provided
          if (callbacks.onUserInputProcessed) {
            console.log('[TaskExecutor][executeGetData] Calling onUserInputProcessed', {
              userInput,
              matchStatus,
              extractedValuesCount: extractedValues?.length || 0,
              extractedValues: extractedValues
            });
            callbacks.onUserInputProcessed(userInput, matchStatus, extractedValues);
          } else {
            console.warn('[TaskExecutor][executeGetData] onUserInputProcessed callback not provided');
          }
        } else {
          console.warn('[TaskExecutor][executeGetData] onProcessInput callback not provided');
        }

        // Now call advance() with the extracted vars (or let it extract internally if onProcessInput wasn't called)
        engineState = advance(engineState, userInput, extractedVars);
      } else if (userInput && typeof userInput === 'object' && 'type' in userInput) {
        // Event object (e.g., { type: 'match', value: '12 2 1980' })
        if (userInput.type === 'exit') {
          return {
            success: false,
            error: new Error('DDT execution exited'),
            retrievalState: 'empty'
          };
        }

        const inputStr = userInput.type === 'match' ? String(userInput.value || '') : '';

        // Process input if callback provided BEFORE calling advance()
        // This allows us to extract values and pass them to onUserInputProcessed
        let extractedVars: Record<string, any> | undefined;
        let extractedValues: any[] | undefined = undefined;
        let matchStatus: 'match' | 'noMatch' | 'partialMatch' = 'noMatch';

        if (callbacks.onProcessInput && inputStr) {
          console.log('[TaskExecutor][executeGetData] Processing input (from event)', { inputStr, hasOnUserInputProcessed: !!callbacks.onUserInputProcessed });
          const processResult = await callbacks.onProcessInput(inputStr, main);
          console.log('[TaskExecutor][executeGetData] Process result (from event)', {
            status: processResult.status,
            hasValue: !!processResult.value,
            valueKeys: processResult.value ? Object.keys(processResult.value) : []
          });

          matchStatus = processResult.status === 'partialMatch' ? 'match' : processResult.status;

          if (processResult.status === 'match' && processResult.value) {
            // ✅ CRITICAL: Contract ritorna { day: 12, month: 2, year: 1980 }
            // advance() si aspetta questo formato direttamente, NON wrappato in { value: ... }
            extractedVars = processResult.value;
            console.log('[TaskExecutor][executeGetData] ✅ Using extracted values directly from Contract (from event)', {
              extractedVars,
              valuesCount: Object.keys(extractedVars).length
            });

            // Convert extracted value to ExtractedValue[] format for display (simple, no nested value)
            extractedValues = Object.entries(processResult.value)
              .filter(([key, val]) => val !== undefined && val !== null)
              .map(([key, val]) => ({
                variable: key,
                linguisticValue: undefined, // Will be filled by useNewFlowOrchestrator
                semanticValue: val
              }));
            console.log('[TaskExecutor][executeGetData] Converted extracted values for display (from event)', {
              extractedValuesCount: extractedValues.length,
              extractedValues
            });
          } else if (processResult.status === 'partialMatch' && processResult.value) {
            // ✅ CRITICAL: For partialMatch, also pass directly
            extractedVars = processResult.value;
            console.log('[TaskExecutor][executeGetData] ✅ Using extracted values (partialMatch, from event)', {
              extractedVars,
              valuesCount: Object.keys(extractedVars).length
            });

            // Convert extracted value to ExtractedValue[] format for display (simple, no nested value)
            extractedValues = Object.entries(processResult.value)
              .filter(([key, val]) => val !== undefined && val !== null)
              .map(([key, val]) => ({
                variable: key,
                linguisticValue: undefined, // Will be filled by useNewFlowOrchestrator
                semanticValue: val
              }));
            console.log('[TaskExecutor][executeGetData] Converted extracted values for display (partialMatch, from event)', {
              extractedValuesCount: extractedValues.length,
              extractedValues
            });
          }

          // Call onUserInputProcessed callback if provided
          if (callbacks.onUserInputProcessed) {
            console.log('[TaskExecutor][executeGetData] Calling onUserInputProcessed (from event)', {
              inputStr,
              matchStatus,
              extractedValuesCount: extractedValues?.length || 0,
              extractedValues: extractedValues
            });
            callbacks.onUserInputProcessed(inputStr, matchStatus, extractedValues);
          } else {
            console.warn('[TaskExecutor][executeGetData] onUserInputProcessed callback not provided');
          }
        } else {
          console.warn('[TaskExecutor][executeGetData] onProcessInput callback not provided or empty input');
        }

        // Now call advance() with the extracted vars
        engineState = advance(engineState, inputStr, extractedVars);
      } else {
        // Fallback: treat as string
        engineState = advance(engineState, String(userInput));
      }

      // Show messages from new state
      showMessageFromState(engineState);

      // 🔍 DEBUG: Log engineState.mode after advance
      console.log('[TaskExecutor][executeGetData] 🔍 Engine state after advance', {
        mode: engineState.mode,
        hasMain: !!getMain(engineState),
        mainId: getMain(engineState)?.id,
        memoryKeys: Object.keys(engineState.memory || {}),
        memoryConfirmed: Object.entries(engineState.memory || {}).filter(([k, v]: [string, any]) => v?.confirmed).map(([k]) => k)
      });

      // Check if completed (SuccessMain means the DDT was successfully completed)
      if (engineState.mode === 'Completed' || engineState.mode === 'SuccessMain') {
        task.state = 'Executed';
        const variables: Record<string, any> = {};

        // ✅ STEP 1: Add variables with GUID as keys (for internal engine)
        // IMPORTANT: Skip composed values with canonical keys (day, month, year, etc.)
        // because sub-nodes are already in memory with their GUIDs
        console.log('[TaskExecutor][executeGetData] 🔍 Analyzing engineState.memory', {
          memoryKeys: Object.keys(engineState.memory),
          memoryEntries: Object.entries(engineState.memory).map(([k, v]: [string, any]) => ({
            key: k.substring(0, 20) + '...',
            confirmed: v?.confirmed,
            valueType: typeof v?.value,
            valueKeys: v?.value && typeof v.value === 'object' ? Object.keys(v.value) : null,
            value: v?.value
          }))
        });

        // Store main node GUID for alias creation
        let mainNodeGuid: string | null = null;

        Object.entries(engineState.memory).forEach(([key, mem]: [string, any]) => {
          if (mem.confirmed) {
            const value = mem.value;

            // ✅ Handle composed values (main node with sub-nodes)
            if (value && typeof value === 'object' && !Array.isArray(value)) {
              const keys = Object.keys(value);

              // If it's an object with multiple keys, it's a composed main node value
              // Extract each sub-node and add it as a separate variable
              if (keys.length > 0) {
                mainNodeGuid = key; // Store for alias creation

                console.log('[TaskExecutor][executeGetData] 🔍 Extracting sub-nodes from composed main node', {
                  mainNodeGuid: key.substring(0, 20) + '...',
                  keysCount: keys.length,
                  keys: keys.slice(0, 5),
                  valuePreview: Object.fromEntries(Object.entries(value).slice(0, 3))
                });

                // Extract each sub-node from the composed value
                Object.entries(value).forEach(([subNodeGuid, subValue]) => {
                  variables[subNodeGuid] = subValue; // Add each sub-node as a separate variable
                  console.log('[TaskExecutor][executeGetData] ✅ Added sub-node variable', {
                    subNodeGuid: subNodeGuid.substring(0, 20) + '...',
                    value: subValue,
                    valueType: typeof subValue
                  });
                });

                return; // Don't add the main node composto itself
              }
            }

            // ✅ Only add simple values (non-composed, e.g., single sub-nodes if they exist separately)
            variables[key] = value; // GUID come chiave
            console.log('[TaskExecutor][executeGetData] ✅ Adding variable to result (completed)', {
              guid: key.substring(0, 20) + '...',
              value: value,
              valueType: typeof value,
              confirmed: mem.confirmed
            });
          }
        });

        // ✅ STEP 2: Enrich with LABEL keys (for scripts)
        // Add labels as additional keys pointing to the same values
        console.log('[TaskExecutor][executeGetData] 🔍 Starting label enrichment', {
          variablesCount: Object.keys(variables).length,
          variableKeys: Object.keys(variables).map(k => k.substring(0, 20) + '...')
        });

        try {
          const { flowchartVariablesService } = await import('../../services/FlowchartVariablesService');

          // ✅ Get projectId from multiple sources (guaranteed fallback to localStorage)
          let projectId: string | undefined = undefined;
          if (typeof window !== 'undefined') {
            // Try window first, then localStorage (note: key is 'current.projectId' with a dot!)
            projectId = (window as any).__currentProjectId ||
                       (window as any).__projectId ||
                       (localStorage.getItem('current.projectId') || undefined);
          }

          console.log('[TaskExecutor][executeGetData] 🔍 FlowchartVariablesService import', {
            hasService: !!flowchartVariablesService,
            projectId,
            hasWindow: typeof window !== 'undefined',
            fromWindow: !!(window as any).__currentProjectId || !!(window as any).__projectId,
            fromLocalStorage: typeof window !== 'undefined' ? !!localStorage.getItem('current.projectId') : false,
            localStorageKey: 'current.projectId'
          });

          if (projectId) {
            await flowchartVariablesService.init(projectId);
            console.log('[TaskExecutor][executeGetData] ✅ FlowchartVariablesService initialized');

            // ✅ Add label keys for each GUID key (sub-nodes)
            Object.entries(variables).forEach(([guid, value]) => {
              const readableName = flowchartVariablesService.getReadableName(guid);
              console.log('[TaskExecutor][executeGetData] 🔍 Mapping GUID to label', {
                guid: guid.substring(0, 20) + '...',
                readableName,
                hasValue: value !== undefined,
                valueType: typeof value
              });

              if (readableName) {
                variables[readableName] = value; // Aggiungi label come chiave aggiuntiva
                console.log('[TaskExecutor][executeGetData] ✅ Added label key', {
                  guid: guid.substring(0, 20) + '...',
                  readableName,
                  valueType: typeof value
                });
              } else {
                console.warn('[TaskExecutor][executeGetData] ⚠️ No readable name found for GUID', {
                  guid: guid.substring(0, 20) + '...',
                  valueType: typeof value,
                  fullGuid: guid
                });
              }
            });

            // ✅ Optional: Add main node alias (e.g., "data A") pointing to composed object
            if (mainNodeGuid) {
              const mainNodeReadableName = flowchartVariablesService.getReadableName(mainNodeGuid);
              if (mainNodeReadableName) {
                // Reconstruct composed object from sub-nodes
                const composedValue: Record<string, any> = {};
                Object.entries(variables).forEach(([key, value]) => {
                  // If key is a GUID (sub-node), add it to composed object
                  if (key.length === 36 && key.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
                    const subNodeLabel = flowchartVariablesService.getReadableName(key);
                    if (subNodeLabel && subNodeLabel.startsWith(mainNodeReadableName + '.')) {
                      // This is a sub-node of the main node
                      const subKey = subNodeLabel.substring(mainNodeReadableName.length + 1); // Remove "data A." prefix
                      composedValue[subKey] = value;
                    }
                  }
                });

                // Add main node alias with composed value (using labels as keys, not canonical)
                if (Object.keys(composedValue).length > 0) {
                  variables[mainNodeReadableName] = composedValue;
                  console.log('[TaskExecutor][executeGetData] ✅ Added main node alias', {
                    mainNodeGuid: mainNodeGuid.substring(0, 20) + '...',
                    mainNodeReadableName,
                    composedKeys: Object.keys(composedValue)
                  });
                }
              }
            }

            const guidKeys = Object.keys(variables).filter(k => k.length === 36 && k.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i));
            const labelKeys = Object.keys(variables).filter(k => !guidKeys.includes(k));

            console.log('[TaskExecutor][executeGetData] ✅ Variables enriched with labels', {
              guidKeysCount: guidKeys.length,
              labelKeysCount: labelKeys.length,
              totalKeys: Object.keys(variables).length,
              guidKeys: guidKeys.slice(0, 5),
              labelKeys: labelKeys.slice(0, 5),
              variablesPreview: Object.fromEntries(Object.entries(variables).slice(0, 10))
            });
          }
        } catch (e) {
          console.warn('[TaskExecutor][executeGetData] ⚠️ Failed to enrich variables with labels', e);
        }

        console.log('[TaskExecutor][executeGetData] 📊 Variables built from memory (completed)', {
          variablesCount: Object.keys(variables).length,
          variableKeys: Object.keys(variables).map(k => k.substring(0, 20) + '...'),
          variables
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

