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
    translations: Record<string, string> = {}
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
      if (task && task.value && task.value.ddt) {
        return task.value.ddt;
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
            ddt: ddtParam || task.value?.ddt // Include DDT in event
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
            hasDDT: !!task.value?.ddt,
            hasNodeContract: !!node?.nlpContract
          });
          console.log('═══════════════════════════════════════════════════════════════════════════');

          // Check if we're in confirmation state - if so, return match directly
          // The DDT engine will handle yes/no detection in processUserInput
          const ddt = task.value?.ddt;
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
    });

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

