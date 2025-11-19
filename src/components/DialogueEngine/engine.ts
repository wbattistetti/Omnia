// Dialogue Engine: Simple loop that finds and executes tasks

import type { CompiledTask, CompilationResult, ExecutionState, RetrievalState } from '../FlowCompiler/types';
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
        isSameReference: nextTask === this.result.tasks.find(t => t.id === nextTask.id)
      });
      // Wait until task is executed (loop continues automatically)
    }
    console.log('[DialogueEngine][runLoop] Loop ended, isRunning:', this.isRunning);
  }

  /**
   * Finds next executable task (condition = true, state = UnExecuted)
   */
  private findNextExecutableTask(): CompiledTask | null {
    for (const task of this.result.tasks) {
      // Skip if already executed or waiting for user input
      if (task.state === 'Executed' || task.state === 'WaitingUserInput') {
        continue;
      }

      // Evaluate condition
      const conditionMet = evaluateCondition(task.condition, this.state);
      if (conditionMet) {
        console.log(`[DialogueEngine] ✅ Found executable task: ${task.id} (action: ${task.action})`, {
          taskId: task.id,
          action: task.action,
          condition: task.condition,
          executedTaskIds: Array.from(this.state.executedTaskIds)
        });
        return task;
      } else {
        // 🔍 DEBUG: Log why condition is not met
        if (task.condition?.type === 'TaskState') {
          const prevTaskExecuted = this.state.executedTaskIds.has(task.condition.taskId);
          console.log(`[DialogueEngine] ⏸️ Task ${task.id} condition not met`, {
            taskId: task.id,
            action: task.action,
            conditionType: task.condition.type,
            requiredTaskId: task.condition.taskId,
            requiredState: task.condition.state,
            prevTaskExecuted,
            executedTaskIds: Array.from(this.state.executedTaskIds)
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
        condition: t.condition
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
      Object.assign(this.state.variableStore, result.variables);
    }

    // Update retrieval state for DDT tasks
    if (task.source.type === 'ddt-step' || task.source.type === 'ddt-recovery-action') {
      if (result.retrievalState) {
        this.state.retrievalState = result.retrievalState as RetrievalState;
      }
    }

    // Update current node/row for flowchart tasks
    if (task.source.type === 'flowchart' && task.source.nodeId) {
      this.state.currentNodeId = task.source.nodeId;
      // Row index would need to be tracked separately
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

