// Dialogue Engine: Simple loop that finds and executes tasks
// Backend Runtime - Copied from frontend and adapted

import type { CompiledTask, CompilationResult, ExecutionState, RetrievalState } from '../compiler/types';
import { evaluateCondition } from './conditionEvaluator';

interface EngineCallbacks {
  onTaskExecute: (task: CompiledTask) => Promise<any>;
  onStateUpdate?: (state: ExecutionState) => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Simple dialogue engine: finds executable tasks and executes them
 */
export class DialogueEngine {
  private result: CompilationResult;
  private state: ExecutionState;
  private callbacks: EngineCallbacks;
  private isRunning: boolean = false;

  constructor(result: CompilationResult, callbacks: EngineCallbacks) {
    this.result = result;
    this.callbacks = callbacks;
    this.state = {
      executedTaskIds: new Set(),
      variableStore: {},
      retrievalState: 'empty',
      currentNodeId: null,
      currentRowIndex: 0
    };
  }

  /**
   * Starts execution from entry task
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('[DialogueEngine] Already running');
      return;
    }

    this.isRunning = true;

    // ✅ Initialize execution state by notifying immediately
    this.callbacks.onStateUpdate?.(this.state);

    try {
      // Start from entry task
      if (this.result.entryTaskId) {
        const entryTask = this.result.taskMap.get(this.result.entryTaskId);
        if (entryTask) {
          await this.executeTask(entryTask);
        }
      }

      // Main loop: find and execute tasks
      await this.runLoop();
    } catch (error) {
      this.callbacks.onError?.(error as Error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Main execution loop
   * Simple and powerful: evaluate conditions → execute task → wait until executed → repeat
   */
  private async runLoop(): Promise<void> {
    console.log('[DialogueEngine][runLoop] Starting loop');
    console.log('[DialogueEngine][runLoop] 📋 All compiled tasks', {
      totalTasks: this.result.tasks.length,
      tasks: this.result.tasks.map(t => ({
        id: t.id,
        action: t.action,
        state: t.state,
        condition: t.condition,
        conditionType: t.condition?.type,
        sourceNodeId: t.source?.nodeId,
        sourceRowText: t.source?.rowText || t.source?.label
      }))
    });
    while (this.isRunning) {
      // Check for suspensive condition: if any task is waiting for user input, stop
      const waitingTask = this.result.tasks.find(t => t.state === 'WaitingUserInput');
      if (waitingTask) {
        // Suspensive condition: stop execution until task is executed
        this.isRunning = false;
        console.log('[DialogueEngine][runLoop] Suspensive condition: task waiting for user input', {
          taskId: waitingTask.id,
          action: waitingTask.action,
          state: waitingTask.state
        });
        break;
      }

      // Evaluate conditions: find next executable task
      console.log('[DialogueEngine][runLoop] Evaluating conditions...');
      const nextTask = this.findNextExecutableTask();

      if (!nextTask) {
        // No more tasks to execute (no condition is true)
        console.log('[DialogueEngine][runLoop] No more executable tasks, completing');
        this.callbacks.onComplete?.();
        break;
      }

      // Execute unique task with condition = true
      console.log('[DialogueEngine][runLoop] Executing task', {
        taskId: nextTask.id,
        action: nextTask.action,
        state: nextTask.state
      });
      const taskStateBefore = nextTask.state;
      await this.executeTask(nextTask);
      const taskStateAfter = nextTask.state;
      console.log('[DialogueEngine][runLoop] Task executed', {
        taskId: nextTask.id,
        stateBefore: taskStateBefore,
        stateAfter: taskStateAfter,
        isSameReference: nextTask === this.result.tasks.find(t => t.id === nextTask.id),
        isRunning: this.isRunning,
        willContinueLoop: this.isRunning
      });

      // 🔍 DEBUG: Check if we should continue the loop
      if (this.isRunning && taskStateAfter === 'Executed') {
        console.log('[DialogueEngine][runLoop] ✅ Task executed, continuing loop to find next task', {
          taskId: nextTask.id,
          executedTaskIds: Array.from(this.state.executedTaskIds),
          variableStoreKeys: Object.keys(this.state.variableStore)
        });
      }
      // Wait until task is executed (loop continues automatically)
    }
    console.log('[DialogueEngine][runLoop] Loop ended, isRunning:', this.isRunning);
  }

  /**
   * Finds next executable task (condition = true, state = UnExecuted)
   */
  private findNextExecutableTask(): CompiledTask | null {
    console.log('[DialogueEngine][findNextExecutableTask] 🚀 START searching', {
      totalTasks: this.result.tasks.length,
      executedTasks: Array.from(this.state.executedTaskIds),
      waitingTasks: this.result.tasks.filter(t => t.state === 'WaitingUserInput').map(t => t.id),
      unexecutedTasks: this.result.tasks.filter(t => t.state === 'UnExecuted').length,
      variableStoreKeys: Object.keys(this.state.variableStore),
      variableStore: this.state.variableStore
    });

    for (const task of this.result.tasks) {
      // Skip if already executed or waiting for user input
      if (task.state === 'Executed' || task.state === 'WaitingUserInput') {
        continue;
      }

      console.log('[DialogueEngine][findNextExecutableTask] 🔍 Checking task', {
        taskId: task.id,
        action: task.action,
        condition: task.condition,
        conditionType: task.condition?.type
      });

      // Evaluate condition
      const conditionMet = evaluateCondition(task.condition, this.state);
      console.log('[DialogueEngine][findNextExecutableTask] ✅ Condition evaluation result', {
        taskId: task.id,
        action: task.action,
        conditionMet,
        conditionType: task.condition?.type,
        condition: task.condition,
        conditionStructure: task.condition ? JSON.stringify(task.condition, null, 2) : null,
        variableStoreKeys: Object.keys(this.state.variableStore),
        executedTaskIds: Array.from(this.state.executedTaskIds)
      });

      if (conditionMet) {
        console.log(`[DialogueEngine] ✅ Found executable task: ${task.id} (action: ${task.action})`, {
          taskId: task.id,
          action: task.action,
          condition: task.condition,
          executedTaskIds: Array.from(this.state.executedTaskIds),
          variableStore: this.state.variableStore
        });
        return task;
      } else {
        // 🔍 DEBUG: Log why condition is not met
        console.log(`[DialogueEngine] ⏸️ Task ${task.id} condition not met`, {
          taskId: task.id,
          action: task.action,
          conditionType: task.condition?.type,
          condition: task.condition,
          executedTaskIds: Array.from(this.state.executedTaskIds),
          variableStore: this.state.variableStore
        });

        if (task.condition?.type === 'TaskState') {
          const prevTaskExecuted = this.state.executedTaskIds.has(task.condition.taskId);
          console.log(`[DialogueEngine] ⏸️ TaskState condition details`, {
            taskId: task.id,
            requiredTaskId: task.condition.taskId,
            requiredState: task.condition.state,
            prevTaskExecuted
          });
        }
      }
    }

    console.log('[DialogueEngine] No more executable tasks found', {
      totalTasks: this.result.tasks.length,
      executedTasks: Array.from(this.state.executedTaskIds),
      waitingTasks: this.result.tasks.filter(t => t.state === 'WaitingUserInput').map(t => t.id),
      unexecutedTasks: this.result.tasks.filter(t => t.state === 'UnExecuted').map(t => ({
        id: t.id,
        action: t.action,
        condition: t.condition,
        conditionType: t.condition?.type,
        sourceNodeId: t.source?.nodeId,
        sourceRowText: t.source?.rowText || t.source?.label
      }))
    });
    return null;
  }

  /**
   * Executes a task
   * Task executor decides the final state (Executed or WaitingUserInput)
   */
  private async executeTask(task: CompiledTask): Promise<void> {
    console.log('[DialogueEngine][executeTask] Starting execution', {
      taskId: task.id,
      action: task.action,
      currentState: task.state,
      hasValue: !!task.value,
      valueKeys: task.value ? Object.keys(task.value) : []
    });

    // ✅ Update currentNodeId IMMEDIATELY when task starts executing (for highlighting)
    if (task.source.nodeId) {
      this.state.currentNodeId = task.source.nodeId;
      console.log('🎨 [HIGHLIGHT] DialogueEngine - Updated currentNodeId (task starting)', {
        taskId: task.id,
        action: task.action,
        sourceType: task.source.type,
        currentNodeId: this.state.currentNodeId
      });
      // Notify state update immediately so UI can highlight the node
      this.callbacks.onStateUpdate?.(this.state);
    }

    try {
      // Execute task (task executor will set the state)
      const result = await this.callbacks.onTaskExecute(task);
      console.log('[DialogueEngine][executeTask] Task executor returned', {
        taskId: task.id,
        result: result ? { success: result.success, hasDDT: !!result.ddt, retrievalState: result.retrievalState } : null,
        taskStateAfter: task.state
      });

      // Task state is set by executor (Executed or WaitingUserInput)
      // If executed, add to executed set
      if (task.state === 'Executed') {
        this.state.executedTaskIds.add(task.id);
        console.log('[DialogueEngine][executeTask] ✅ Task marked as Executed, added to executedTaskIds', {
          taskId: task.id,
          action: task.action,
          executedTaskIds: Array.from(this.state.executedTaskIds),
          executedCount: this.state.executedTaskIds.size
        });
      } else if (task.state === 'WaitingUserInput') {
        console.log('[DialogueEngine][executeTask] ⏸️ Task marked as WaitingUserInput (suspensive condition)', {
          taskId: task.id,
          action: task.action
        });
      }

      // Update state based on result
      if (result) {
        this.updateStateFromResult(task, result);
        console.log('[DialogueEngine][executeTask] State updated', {
          retrievalState: this.state.retrievalState,
          variableStoreKeys: Object.keys(this.state.variableStore)
        });
      }

      // Notify state update
      this.callbacks.onStateUpdate?.(this.state);
      console.log('🎨 [HIGHLIGHT] DialogueEngine - onStateUpdate called', {
        taskId: task.id,
        currentNodeId: this.state.currentNodeId,
        executedTaskIds: Array.from(this.state.executedTaskIds),
        executedCount: this.state.executedTaskIds.size,
        variableStoreKeys: Object.keys(this.state.variableStore)
      });

    } catch (error) {
      console.error(`[DialogueEngine][executeTask] Error executing task ${task.id}:`, error);
      this.callbacks.onError?.(error as Error);
      throw error;
    }
  }

  /**
   * Updates execution state from task result
   */
  private updateStateFromResult(task: CompiledTask, result: any): void {
    // Update variable store
    if (result.variables) {
      // Helper to identify GUID keys (36 chars with hyphens)
      const isGuid = (key: string) => key.length === 36 && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key);

      const guidKeys = Object.keys(result.variables).filter(isGuid);
      const labelKeys = Object.keys(result.variables).filter(k => !isGuid(k));

      console.log('[DialogueEngine][updateStateFromResult] 🔄 Updating variableStore', {
        taskId: task.id,
        action: task.action,
        variablesCount: Object.keys(result.variables).length,
        guidKeysCount: guidKeys.length,
        labelKeysCount: labelKeys.length,
        guidKeys: guidKeys.slice(0, 5),
        labelKeys: labelKeys.slice(0, 5),
        variableKeys: Object.keys(result.variables).map(k => k.substring(0, 20) + '...'),
        variables: result.variables,
        variableStoreBefore: { ...this.state.variableStore }
      });
      Object.assign(this.state.variableStore, result.variables);

      const finalGuidKeys = Object.keys(this.state.variableStore).filter(isGuid);
      const finalLabelKeys = Object.keys(this.state.variableStore).filter(k => !isGuid(k));

      console.log('[DialogueEngine][updateStateFromResult] ✅ variableStore updated', {
        taskId: task.id,
        variableStoreAfter: { ...this.state.variableStore },
        variableStoreKeys: Object.keys(this.state.variableStore),
        guidKeysCount: finalGuidKeys.length,
        labelKeysCount: finalLabelKeys.length,
        guidKeys: finalGuidKeys.slice(0, 5),
        labelKeys: finalLabelKeys.slice(0, 5)
      });
    } else {
      console.log('[DialogueEngine][updateStateFromResult] ⚠️ No variables in result', {
        taskId: task.id,
        action: task.action,
        hasResult: !!result
      });
    }

    // Update retrieval state for DDT tasks
    if (task.source.type === 'ddt-step' || task.source.type === 'ddt-recovery-action') {
      if (result.retrievalState) {
        this.state.retrievalState = result.retrievalState as RetrievalState;
      }
    }

    // Update current node/row for all tasks that have a nodeId (flowchart or DDT from flowchart)
    // DDT tasks can have nodeId if they come from a flowchart node that triggered the DDT
    if (task.source.nodeId) {
      this.state.currentNodeId = task.source.nodeId;
      console.log('🎨 [HIGHLIGHT] DialogueEngine - Updated currentNodeId', {
        taskId: task.id,
        action: task.action,
        sourceType: task.source.type,
        currentNodeId: this.state.currentNodeId
      });
    }
  }

  /**
   * Stops execution
   */
  stop(): void {
    this.isRunning = false;
  }

  /**
   * Resets engine state (clears executed tasks, variables, etc.)
   */
  reset(): void {
    this.isRunning = false;
    // Reset all tasks to UnExecuted
    for (const task of this.result.tasks) {
      task.state = 'UnExecuted';
    }
    // Reset execution state
    this.state = {
      executedTaskIds: new Set(),
      variableStore: {},
      retrievalState: 'empty',
      currentNodeId: null,
      currentRowIndex: 0
    };
    // Notify state update
    this.callbacks.onStateUpdate?.(this.state);
  }

  /**
   * Gets current execution state
   */
  getState(): ExecutionState {
    return { ...this.state };
  }

  /**
   * Updates retrieval state (for DDT)
   */
  updateRetrievalState(state: RetrievalState): void {
    this.state.retrievalState = state;
  }

  /**
   * Completes a task that was waiting for user input
   * Marks task as Executed and updates retrieval state, then resumes loop
   */
  completeWaitingTask(taskId: string, retrievalState?: RetrievalState): void {
    const task = this.result.taskMap.get(taskId);
    if (!task) {
      console.warn(`[DialogueEngine] Task not found for completion: ${taskId}`);
      return;
    }

    if (task.state !== 'WaitingUserInput') {
      console.warn(`[DialogueEngine] Task ${taskId} is not in WaitingUserInput state: ${task.state}`);
      return;
    }

    // Mark as Executed
    task.state = 'Executed';
    this.state.executedTaskIds.add(task.id);

    // Update retrieval state if provided
    if (retrievalState) {
      this.state.retrievalState = retrievalState;
    }

    // Notify state update
    this.callbacks.onStateUpdate?.(this.state);

    // Resume loop if it was stopped
    if (!this.isRunning) {
      this.isRunning = true;
      // Continue loop (will recalculate conditions automatically)
      this.runLoop().catch(error => {
        this.callbacks.onError?.(error as Error);
        this.isRunning = false;
      });
    }
  }
}

