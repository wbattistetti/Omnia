// Task Executors: Execute different types of tasks - Backend Runtime
// Backend version - adapted from frontend

import type { CompiledTask } from '../compiler/types';
import type { AssembledDDT } from '../ddt/types';
import { runDDT } from '../ddt/ddtEngine';
import type { RetrieveResult } from '../ddt/types';

export interface TaskExecutionResult {
  success: boolean;
  variables?: Record<string, any>;
  retrievalState?: 'empty' | 'asrNoMatch' | 'asrNoInput' | 'saturated' | 'confirmed';
  ddt?: AssembledDDT;
  error?: Error;
}

/**
 * Normalizes action ID to action type
 */
function normalizeActionType(action: string, task?: any): string {
  const standardTypes = ['SayMessage', 'Message', 'GetData', 'ClassifyProblem', 'ProblemClassification', 'callBackend', 'BackendCall', 'AIAgent'];
  if (standardTypes.includes(action)) {
    return action;
  }

  // ✅ Fields directly on task (no value wrapper)
  const hasDDT = task?.mainData && task.mainData.length > 0;
  const hasText = task?.text !== undefined;
  const hasIntents = task?.intents && task.intents.length > 0;
  const hasConfig = task?.config !== undefined;

  if (hasDDT) {
    return 'GetData';
  }
  if (hasText) {
    return 'SayMessage';
  }
  if (hasIntents) {
    return 'ClassifyProblem';
  }
  if (hasConfig) {
    return 'BackendCall';
  }

  if (action.startsWith('item_')) {
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
    onMessage?: (text: string, stepType?: string, escalationNumber?: number) => void;
    onDDTStart?: (ddt: AssembledDDT) => void;
    onBackendCall?: (config: any) => Promise<any>;
    onProblemClassify?: (intents: any[], ddt: AssembledDDT) => Promise<any>;
    onGetRetrieveEvent?: (nodeId: string, ddt?: AssembledDDT) => Promise<any>;
    onProcessInput?: (input: string, node: any) => Promise<{ status: 'match' | 'noMatch' | 'noInput' | 'partialMatch'; value?: any }>;
    onUserInputProcessed?: (input: string, matchStatus: 'match' | 'noMatch' | 'partialMatch', extractedValues?: any[]) => void;
    translations?: Record<string, string>;
  }
): Promise<TaskExecutionResult> {
  console.log('[BACKEND][TaskExecutor] Executing task:', {
    taskId: task.id,
    action: task.action,
    normalizedAction: normalizeActionType(task.action, task),
    location: 'BACKEND'
  });

  try {
    const normalizedAction = normalizeActionType(task.action, task);

    switch (normalizedAction) {
      case 'SayMessage':
      case 'Message':
        return await executeSayMessage(task, {
          onMessage: callbacks.onMessage,
          translations: callbacks.translations
        });

      case 'GetData':
        return await executeGetData(task, {
          onMessage: callbacks.onMessage,
          onDDTStart: callbacks.onDDTStart,
          onGetRetrieveEvent: callbacks.onGetRetrieveEvent,
          onProcessInput: callbacks.onProcessInput,
          onUserInputProcessed: callbacks.onUserInputProcessed,
          translations: callbacks.translations
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
        console.warn(`[BACKEND][TaskExecutor] Unknown action type: ${task.action} (normalized: ${normalizedAction})`);
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
 */
async function executeSayMessage(
  task: CompiledTask,
  callbacks: {
    onMessage?: (text: string, stepType?: string, escalationNumber?: number) => void;
    translations?: Record<string, string>;
  }
): Promise<TaskExecutionResult> {
  // ✅ Fields directly on task (no value wrapper)
  let text = task.text || '';

  // Resolve GUID/text key using translations
  if (text) {
    const translations = callbacks.translations || {};
    const isGuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text);

    if (isGuid || translations[text]) {
      const resolvedText = translations[text];
      if (resolvedText && typeof resolvedText === 'string' && resolvedText.trim().length > 0) {
        console.log('[BACKEND][TaskExecutor][executeSayMessage] ✅ Resolved GUID/text key', {
          taskId: task.id,
          originalText: text.substring(0, 20) + '...',
          resolvedText: resolvedText.substring(0, 50) + '...'
        });
        text = resolvedText;
      }
    }
  }

  if (!text) {
    console.warn('[BACKEND][TaskExecutor] SayMessage task has no text', { taskId: task.id });
    if (callbacks.onMessage) {
      callbacks.onMessage('⚠️ Message task missing text', 'warning');
    }
    task.state = 'Executed';
    return {
      success: false,
      error: new Error('SayMessage task missing text')
    };
  }

  if (callbacks.onMessage) {
    callbacks.onMessage(text);
  }

  // Check if interactive (recovery action)
  const parentRowAction = task.source?.parentRowAction;
  const isInteractiveRow = parentRowAction === 'GetData' || parentRowAction === 'ClassifyProblem';
  const isRecoveryAction = task.source?.type === 'ddt-recovery-action';

  if (isInteractiveRow && isRecoveryAction) {
    task.state = 'WaitingUserInput';
  } else {
    task.state = 'Executed';
  }

  return {
    success: true,
    variables: {}
  };
}

/**
 * Execute DataRequest task using backend DDT Engine
 */
async function executeGetData(  // ✅ Function name kept for backward compatibility
  task: CompiledTask,
  callbacks: {
    onMessage?: (text: string, stepType?: string, escalationNumber?: number) => void;
    onDDTStart?: (ddt: AssembledDDT) => void;
    onGetRetrieveEvent?: (nodeId: string, ddt?: AssembledDDT) => Promise<any>;
    onProcessInput?: (input: string, node: any) => Promise<any>;
    onUserInputProcessed?: (input: string, matchStatus: 'match' | 'noMatch' | 'partialMatch', extractedValues?: any[]) => void;
    translations?: Record<string, string>;
  }
): Promise<TaskExecutionResult> {
  console.log('[BACKEND][TaskExecutor][executeGetData] 🚀 STARTING', {
    taskId: task.id,
    taskAction: task.action
  });

  // ✅ DDT fields directly on task (no value wrapper)
  // ❌ REMOVED: label non serve a runtime (solo per UI)
  const ddt = (task.mainData && task.mainData.length > 0) ? {
    mainData: task.mainData,
    stepPrompts: task.stepPrompts,
    constraints: task.constraints,
  } : null;

  if (!ddt) {
    console.error('[BACKEND][TaskExecutor][executeGetData] DataRequest task missing DDT', {
      taskId: task.id
    });
    return {
      success: false,
      error: new Error('DataRequest task missing DDT')
    };
  }

  // Start DDT
  if (callbacks.onDDTStart) {
    callbacks.onDDTStart(ddt);
  }

  // Mark as WaitingUserInput - DDT will be executed via session manager
  task.state = 'WaitingUserInput';

  // Create DDT callbacks for backend DDT Engine
  const ddtCallbacks = {
    onMessage: callbacks.onMessage,
    onGetRetrieveEvent: async (nodeId: string, ddtParam?: AssembledDDT) => {
      if (callbacks.onGetRetrieveEvent) {
        return await callbacks.onGetRetrieveEvent(nodeId, ddtParam || ddt);
      }
      throw new Error('onGetRetrieveEvent not provided');
    },
    onProcessInput: callbacks.onProcessInput || (async (input: string, node: any) => {
      return { status: 'match' as const, value: input };
    }),
    translations: callbacks.translations || {}
  };

  // Run DDT Engine directly (backend version)
  try {
    console.log('[BACKEND][TaskExecutor][executeGetData] Running backend DDT Engine', {
      taskId: task.id,
      ddtId: ddt.id
    });

    const result = await runDDT(ddt, ddtCallbacks, {});

    if (result.success) {
      task.state = 'Executed';
      return {
        success: true,
        variables: result.value || {},
        retrievalState: 'saturated',
        ddt
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
    console.error('[BACKEND][TaskExecutor][executeGetData] Error', error);
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
 */
async function executeClassifyProblem(
  task: CompiledTask,
  callbacks: { onProblemClassify?: (intents: any[], ddt: AssembledDDT) => Promise<any> }
): Promise<TaskExecutionResult> {
  // ✅ Fields directly on task (no value wrapper)
  const intents = task.intents || [];
  const ddt = (task.mainData && task.mainData.length > 0) ? {
    label: task.label,
    mainData: task.mainData,
    stepPrompts: task.stepPrompts,
    constraints: task.constraints,
  } : null;

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
 */
async function executeBackendCall(
  task: CompiledTask,
  callbacks: { onBackendCall?: (config: any) => Promise<any> }
): Promise<TaskExecutionResult> {
  // ✅ Fields directly on task (no value wrapper)
  const config = task.config;

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
 */
async function executeAIAgent(
  task: CompiledTask,
  _callbacks: { onMessage?: (text: string, stepType?: string, escalationNumber?: number) => void }
): Promise<TaskExecutionResult> {
  // TODO: Implement AI Agent execution
  task.state = 'Executed';
  return {
    success: true,
    variables: {}
  };
}

