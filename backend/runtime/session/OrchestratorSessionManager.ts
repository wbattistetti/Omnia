// Orchestrator Session Manager - Backend Runtime
// Manages Flow Orchestrator sessions for interactive flow execution with SSE support

import type { CompilationResult, CompiledTask, ExecutionState } from '../compiler/types';
import { DialogueEngine } from '../orchestrator/engine';
import { EventEmitter } from 'events';
import { taskRepository } from '../../services/TaskRepository';

export interface OrchestratorSession {
  id: string;
  compilationResult: CompilationResult;
  engine: DialogueEngine;
  messages: Array<{
    id: string;
    text: string;
    stepType?: string;
    escalationNumber?: number;
    timestamp: string;
    taskId?: string;
  }>;
  isRunning: boolean;
  isComplete: boolean;
  error?: Error;
  createdAt: Date;
  lastActivity: Date;
  eventEmitter: EventEmitter;
  waitingForInput?: { taskId: string; nodeId?: string; timestamp: Date };
  executionState?: ExecutionState;
}

export class OrchestratorSessionManager {
  private sessions: Map<string, OrchestratorSession> = new Map();
  private sessionTimeout: number = 30 * 60 * 1000; // 30 minutes

  /**
   * Creates a new orchestrator session
   */
  createSession(
    compilationResult: CompilationResult,
    tasks: any[],
    ddts: any[],
    translations: Record<string, string> = {},
    projectId?: string
  ): string {
    const sessionId = `orch_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('🚀 [ORCHESTRATOR SESSION] Creating new orchestrator session');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('[ORCHESTRATOR SESSION] Session info:', {
      sessionId,
      tasksCount: compilationResult.tasks.length,
      entryTaskId: compilationResult.entryTaskId,
      hasTranslations: Object.keys(translations).length > 0,
      translationsCount: Object.keys(translations).length
    });

    // Store tasks and DDTs in memory for task execution
    // Note: In a real scenario, these would be stored in a database or cache
    const taskMap = new Map();
    tasks.forEach(task => {
      taskMap.set(task.id, task);
    });

    const ddtMap = new Map();
    ddts.forEach(ddt => {
      if (ddt.id) {
        ddtMap.set(ddt.id, ddt);
      }
    });

    // Prepare callbacks for DialogueEngine
    const messages: Array<{
      id: string;
      text: string;
      stepType?: string;
      escalationNumber?: number;
      timestamp: string;
      taskId?: string;
    }> = [];
    const pendingInputs: Map<string, { resolve: (value: any) => void; reject: (error: Error) => void }> = new Map();
    const eventEmitter = new EventEmitter();

    // Import task executors (backend version)
    const getTask = (taskId: string) => {
      return taskMap.get(taskId) || null;
    };

    const getDDT = (taskId: string) => {
      const task = getTask(taskId);
      // ✅ DDT fields directly on task (no value wrapper)
      if (task && task.mainData && task.mainData.length > 0) {
        return {
          label: task.label,
          mainData: task.mainData,
          steps: task.steps,
          constraints: task.constraints,
        };
      }
      return ddtMap.get(taskId) || null;
    };

    // Create task executor callback
    const onTaskExecute = async (task: CompiledTask): Promise<any> => {
      console.log('[ORCHESTRATOR SESSION] Executing task', {
        sessionId,
        taskId: task.id,
        action: task.action
      });

      // Import backend task executors
      // Register ts-node if needed
      try {
        require('ts-node').register({
          transpileOnly: true,
          compilerOptions: {
            module: 'commonjs',
            esModuleInterop: true,
            resolveJsonModule: true
          }
        });
      } catch (e) {
        // Already registered
      }

      const taskExecutorsModule = require('../orchestrator/taskExecutors.ts');
      const { executeTask } = taskExecutorsModule;

      return await executeTask(task, {
        onMessage: (text: string, stepType?: string, escalationNumber?: number) => {
          const msgId = `${task.id}-${Date.now()}-${Math.random()}`;
          const msg = {
            id: msgId,
            text,
            stepType: stepType || 'message',
            escalationNumber,
            timestamp: new Date().toISOString(),
            taskId: task.id
          };
          messages.push(msg);
          console.log('═══════════════════════════════════════════════════════════════════════════');
          console.log('[ORCHESTRATOR SESSION] 📨 Message added', {
            sessionId,
            text: text.substring(0, 100),
            stepType,
            escalationNumber,
            taskId: task.id,
            messageId: msgId
          });
          console.log('═══════════════════════════════════════════════════════════════════════════');
          eventEmitter.emit('message', msg);
          console.log('[ORCHESTRATOR SESSION] ✅ Message event emitted via SSE', {
            stepType,
            hasEventEmitter: !!eventEmitter,
            listenerCount: eventEmitter.listenerCount('message')
          });
        },
        onDDTStart: (ddt: any) => {
          console.log('[ORCHESTRATOR SESSION] DDT started', {
            sessionId,
            ddtId: ddt?.id,
            taskId: task.id
          });
          eventEmitter.emit('ddtStart', { ddt, taskId: task.id });
        },
        onGetRetrieveEvent: async (nodeId: string, ddtParam?: any) => {
          console.log('═══════════════════════════════════════════════════════════════════════════');
          console.log('⏳ [ORCHESTRATOR SESSION] Waiting for user input', { sessionId, nodeId, taskId: task.id, hasDDT: !!ddtParam });
          console.log('═══════════════════════════════════════════════════════════════════════════');

          session.waitingForInput = { taskId: task.id, nodeId, timestamp: new Date() };
          // Emit waitingForInput with DDT info so frontend can show input box
          eventEmitter.emit('waitingForInput', {
            taskId: task.id,
            nodeId,
            // ✅ DDT fields directly on task (no value wrapper)
            ddt: ddtParam || (task.mainData && task.mainData.length > 0 ? {
              label: task.label,
              mainData: task.mainData,
              steps: task.steps,
              constraints: task.constraints,
            } : null) // Include DDT in event
          });

          return new Promise((resolve, reject) => {
            pendingInputs.set(`${task.id}-${nodeId}`, { resolve, reject });
          });
        },
        onProcessInput: async (input: string, node: any) => {
          console.log('═══════════════════════════════════════════════════════════════════════════');
          console.log('[ORCHESTRATOR SESSION] 🔍 onProcessInput called', {
            sessionId,
            input,
            nodeId: node?.id,
            taskId: task.id,
            nodeLabel: node?.label,
            hasDDT: !!(task.mainData && task.mainData.length > 0),
            hasNodeContract: !!node?.nlpContract
          });
          console.log('═══════════════════════════════════════════════════════════════════════════');

          // Check if we're in confirmation state - if so, return match directly
          // The DDT engine will handle yes/no detection in processUserInput
          // ✅ DDT fields directly on task (no value wrapper)
          const ddt = (task.mainData && task.mainData.length > 0) ? {
            label: task.label,
            mainData: task.mainData,
            steps: task.steps,
            constraints: task.constraints,
          } : null;
          if (ddt) {
            // Use backend DDT contract extraction
            try {
              console.log('[ORCHESTRATOR SESSION] Loading contract for node', { nodeId: node.id, ddtId: ddt.id, hasNodeContract: !!node?.nlpContract });
              const { loadContract, extractWithContractSync } = require('../ddt/utils');
              // Pass node object directly, not node.id!
              const contract = await loadContract(node, ddt);
              console.log('[ORCHESTRATOR SESSION] Contract loaded', {
                hasContract: !!contract,
                hasExtractor: !!contract?.extractor,
                contractKeys: contract ? Object.keys(contract) : []
              });

              if (contract) {
                console.log('[ORCHESTRATOR SESSION] Calling extractWithContractSync', { input });
                const extractionResult = extractWithContractSync(input, contract);
                console.log('[ORCHESTRATOR SESSION] Extraction result', {
                  hasMatch: extractionResult.hasMatch,
                  values: extractionResult.values,
                  source: extractionResult.source,
                  confidence: extractionResult.confidence
                });

                if (extractionResult.hasMatch) {
                  console.log('[ORCHESTRATOR SESSION] ✅ Contract extraction successful - returning match', {
                    values: extractionResult.values,
                    valueKeys: Object.keys(extractionResult.values || {}),
                    source: extractionResult.source
                  });
                  return { status: 'match' as const, value: extractionResult.values };
                } else {
                  console.warn('[ORCHESTRATOR SESSION] ⚠️ Contract extraction hasMatch=false - falling back to raw input');
                }
              } else {
                console.warn('[ORCHESTRATOR SESSION] ⚠️ No contract loaded - falling back to raw input');
              }
            } catch (error) {
              console.error('[ORCHESTRATOR SESSION] ❌ Contract extraction error', {
                error: error.message,
                stack: error.stack
              });
            }
          } else {
            console.log('[ORCHESTRATOR SESSION] No DDT available - falling back to raw input');
          }

          // Fallback: return raw input as match
          console.log('[ORCHESTRATOR SESSION] Returning raw input as match', { input });
          return { status: 'match' as const, value: input };
        },
        onUserInputProcessed: (input: string, matchStatus: 'match' | 'noMatch' | 'partialMatch', extractedValues?: any[]) => {
          console.log('[ORCHESTRATOR SESSION] Input processed', {
            sessionId,
            input: input.substring(0, 50),
            matchStatus,
            taskId: task.id
          });
          eventEmitter.emit('userInputProcessed', { input, matchStatus, extractedValues, taskId: task.id });
        },
        onBackendCall: async (config: any) => {
          console.log('[ORCHESTRATOR SESSION] BackendCall requested', {
            sessionId,
            taskId: task.id,
            hasConfig: !!config,
            hasMockTable: !!(config?.mockTable || (task as any).mockTable || (task as any).value?.mockTable)
          });

          // Get config from task (support both flattened and value-wrapped structures)
          const taskConfig = config || (task as any).config || (task as any).value?.config;
          const mockTable = taskConfig?.mockTable || (task as any).mockTable || (task as any).value?.mockTable;

          if (!taskConfig) {
            console.error('[ORCHESTRATOR SESSION] BackendCall config not found', {
              sessionId,
              taskId: task.id,
              taskKeys: Object.keys(task),
              hasValue: !!(task as any).value,
              valueKeys: (task as any).value ? Object.keys((task as any).value) : []
            });
            return {
              success: false,
              error: 'BackendCall config not found'
            };
          }

          // Get current execution state variableStore
          const variableStore = session.executionState?.variableStore || {};

          console.log('[ORCHESTRATOR SESSION] BackendCall matching', {
            sessionId,
            taskId: task.id,
            hasMockTable: !!mockTable,
            mockTableRows: mockTable?.length || 0,
            inputsCount: taskConfig.inputs?.length || 0,
            outputsCount: taskConfig.outputs?.length || 0,
            variableStoreKeys: Object.keys(variableStore)
          });

          // ✅ Deterministic typed matching function
          // Matches input values with type checking, null/undefined handling, and deep comparison
          const matchesInput = (rowValue: any, currentValue: any): boolean => {
            // ✅ Type check: same type required (10 !== "10")
            if (typeof rowValue !== typeof currentValue) {
              return false;
            }

            // ✅ Null/undefined handling (explicit)
            if (rowValue === null && currentValue === null) return true;
            if (rowValue === null || currentValue === null) return false;
            if (rowValue === undefined && currentValue === undefined) return true;
            if (rowValue === undefined || currentValue === undefined) return false;

            // ✅ Deep comparison for objects/arrays
            if (typeof rowValue === 'object' && rowValue !== null) {
              // Handle arrays and objects
              return JSON.stringify(rowValue) === JSON.stringify(currentValue);
            }

            // ✅ Exact match for primitives (case-sensitive for strings)
            return rowValue === currentValue;
          };

          // If mockTable exists, try to match input values
          if (mockTable && Array.isArray(mockTable) && mockTable.length > 0) {
            const inputs = taskConfig.inputs || [];
            const outputs = taskConfig.outputs || [];

            // Build current input values from variableStore
            const currentInputValues: Record<string, any> = {};
            for (const input of inputs) {
              if (input.variable && input.internalName) {
                const varValue = variableStore[input.variable];
                currentInputValues[input.internalName] = varValue;
              }
            }

            console.log('[ORCHESTRATOR SESSION] BackendCall current input values', {
              sessionId,
              taskId: task.id,
              currentInputValues,
              inputDefinitions: inputs.map((inp: any) => ({
                internalName: inp.internalName,
                variable: inp.variable
              }))
            });

            // ✅ Find ALL matching rows (for validation)
            const matchingRows = mockTable.filter((row: any) => {
              if (!row.inputs || typeof row.inputs !== 'object') {
                return false;
              }

              // ✅ Complete match: ALL inputs must match
              return inputs.every((input: any) => {
                if (!input.internalName) return false;
                const rowValue = row.inputs[input.internalName];
                const currentValue = currentInputValues[input.internalName];
                return matchesInput(rowValue, currentValue);
              });
            });

            // ✅ Validation: exactly 0 or 1 row (never 2+)
            if (matchingRows.length === 0) {
              // No match found: task executed without modifying variables
              console.warn('[ORCHESTRATOR SESSION] BackendCall no matching row found', {
                sessionId,
                taskId: task.id,
                currentInputValues,
                mockTableRows: mockTable.length,
                mockTableRowIds: mockTable.map((r: any) => r.id || 'no-id'),
                message: 'Task executed successfully but no mockTable row matched. No variables modified.'
              });
              // ✅ success: true means "task executed without modifying variables" (not "mock found")
              return {
                success: true,
                variables: {} // Empty = no variables modified
              };
            }

            if (matchingRows.length > 1) {
              // ⚠️ ERROR: Multiple rows match (non-deterministic)
              console.error('[ORCHESTRATOR SESSION] BackendCall multiple rows match', {
                sessionId,
                taskId: task.id,
                matchingRowsCount: matchingRows.length,
                matchingRowIds: matchingRows.map((r: any) => r.id || 'no-id'),
                currentInputValues,
                message: 'MockTable must have unique input combinations. Multiple rows matched.'
              });
              return {
                success: false,
                error: `Multiple mockTable rows match (${matchingRows.length} rows). MockTable must have unique input combinations.`,
                variables: {}
              };
            }

            // ✅ Exactly 1 row matched
            const matchedRow = matchingRows[0];
            console.log('[ORCHESTRATOR SESSION] BackendCall matched row', {
              sessionId,
              taskId: task.id,
              rowId: matchedRow.id || 'no-id',
              rowInputs: matchedRow.inputs,
              rowOutputs: matchedRow.outputs
            });

            if (matchedRow.outputs) {
              // Map output values to variableStore varIds
              const outputVariables: Record<string, any> = {};
              for (const output of outputs) {
                if (output.variable && output.internalName) {
                  const outputValue = matchedRow.outputs[output.internalName];
                  if (outputValue !== undefined) {
                    outputVariables[output.variable] = outputValue;
                  }
                }
              }

              console.log('[ORCHESTRATOR SESSION] BackendCall returning matched outputs', {
                sessionId,
                taskId: task.id,
                outputVariables,
                outputCount: Object.keys(outputVariables).length
              });

              return {
                success: true,
                variables: outputVariables
              };
            } else {
              // Row matched but no outputs defined
              console.warn('[ORCHESTRATOR SESSION] BackendCall matched row has no outputs', {
                sessionId,
                taskId: task.id,
                rowId: matchedRow.id || 'no-id'
              });
              return {
                success: true,
                variables: {} // No outputs to write
              };
            }
          } else {
            // No mockTable: return empty (or could make actual API call in future)
            console.log('[ORCHESTRATOR SESSION] BackendCall no mockTable, returning empty', {
              sessionId,
              taskId: task.id,
              message: 'No mockTable defined. Task executed without backend call.'
            });
            return {
              success: true,
              variables: {}
            };
          }
        },
        translations: translations
      });
    };

    // Create DialogueEngine instance
    const engine = new DialogueEngine(compilationResult, {
      onTaskExecute,
      onStateUpdate: (state: ExecutionState) => {
        session.executionState = state;
        console.log('[ORCHESTRATOR SESSION] State updated', {
          sessionId,
          currentNodeId: state.currentNodeId,
          executedCount: state.executedTaskIds.size
        });
        eventEmitter.emit('stateUpdate', state);
      },
      onComplete: () => {
        session.isComplete = true;
        session.isRunning = false;
        console.log('[ORCHESTRATOR SESSION] Execution completed', { sessionId });
        eventEmitter.emit('complete', { success: true });
      },
      onError: (error: Error) => {
        session.error = error;
        session.isRunning = false;
        console.error('[ORCHESTRATOR SESSION] Execution error', { sessionId, error: error.message });
        eventEmitter.emit('error', { error: error.message });
      }
    }, projectId);

    const session: OrchestratorSession = {
      id: sessionId,
      compilationResult,
      engine,
      messages,
      isRunning: false,
      isComplete: false,
      createdAt: new Date(),
      lastActivity: new Date(),
      eventEmitter,
      executionState: {
        executedTaskIds: new Set(),
        variableStore: {},
        retrievalState: 'empty',
        currentNodeId: null,
        currentRowIndex: 0
      }
    };

    // Store pending inputs resolver
    (session as any).pendingInputs = pendingInputs;

    this.sessions.set(sessionId, session);

    // Start execution in background
    session.isRunning = true;
    engine.start().catch((error) => {
      session.error = error;
      session.isRunning = false;
      console.error('[ORCHESTRATOR SESSION] Engine start error', { sessionId, error: error.message });
      eventEmitter.emit('error', { error: error.message });
    });

    return sessionId;
  }

  /**
   * Provides user input to a waiting task
   */
  provideInput(sessionId: string, input: string): { success: boolean; error?: string } {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    if (!session.waitingForInput) {
      return { success: false, error: 'No task waiting for input' };
    }

    const { taskId, nodeId } = session.waitingForInput;
    const pendingInputs = (session as any).pendingInputs as Map<string, { resolve: (value: any) => void; reject: (error: Error) => void }>;
    const resolver = pendingInputs.get(`${taskId}-${nodeId}`);

    if (!resolver) {
      return { success: false, error: 'No pending input resolver found' };
    }

    session.lastActivity = new Date();
    session.waitingForInput = undefined;

    // Resolve with input event
    resolver.resolve({ type: 'match', value: input });

    return { success: true };
  }

  /**
   * Gets session by ID
   */
  getSession(sessionId: string): OrchestratorSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Gets session status
   */
  getSessionStatus(sessionId: string): { found: boolean; session?: OrchestratorSession } {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { found: false };
    }
    return { found: true, session };
  }

  /**
   * Deletes a session
   */
  deleteSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    // Stop engine if running
    if (session.isRunning) {
      session.engine.stop();
    }

    this.sessions.delete(sessionId);
    return true;
  }

  /**
   * Cleanup old sessions
   */
  cleanup(): void {
    const now = Date.now();
    for (const [sessionId, session] of this.sessions.entries()) {
      const age = now - session.lastActivity.getTime();
      if (age > this.sessionTimeout) {
        console.log('[ORCHESTRATOR SESSION] Cleaning up old session', { sessionId, age });
        this.deleteSession(sessionId);
      }
    }
  }
}

// Singleton instance
export const orchestratorSessionManager = new OrchestratorSessionManager();

// Cleanup every 5 minutes
setInterval(() => {
  orchestratorSessionManager.cleanup();
}, 5 * 60 * 1000);

