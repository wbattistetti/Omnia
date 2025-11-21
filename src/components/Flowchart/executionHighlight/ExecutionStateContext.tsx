// Execution State Context
// Provides execution state to flowchart components for highlighting

import React, { createContext, useContext, ReactNode } from 'react';
import type { ExecutionState } from '../../FlowCompiler/types';
import type { CompiledTask } from '../../FlowCompiler/types';

export interface ExecutionHighlightState {
  executionState: ExecutionState | null;
  currentTask: CompiledTask | null;
  isRunning: boolean;
  // Helper: check if a task is executed
  isTaskExecuted: (taskId: string) => boolean;
  // Helper: check if a node is currently executing
  isNodeExecuting: (nodeId: string) => boolean;
  // Helper: check if a row is currently executing
  isRowExecuting: (rowId: string) => boolean;
  // Helper: get step type for a row (for DDT highlighting)
  getRowStepType: (rowId: string) => 'stepStart' | 'stepMatch' | 'stepNoMatch' | null;
}

const ExecutionStateContext = createContext<ExecutionHighlightState | null>(null);

export interface ExecutionStateProviderProps {
  executionState: ExecutionState | null;
  currentTask: CompiledTask | null;
  isRunning: boolean;
  children: ReactNode;
}

export function ExecutionStateProvider({
  executionState,
  currentTask,
  isRunning,
  children
}: ExecutionStateProviderProps) {
  // 🎨 [HIGHLIGHT] Log execution state for debugging (only when values change)
  const prevStateRef = React.useRef<{ currentNodeId?: string | null; executedCount?: number; isRunning?: boolean }>({});
  React.useEffect(() => {
    if (!isRunning) return;

    const prev = prevStateRef.current;
    const current = {
      currentNodeId: executionState?.currentNodeId,
      executedCount: executionState ? executionState.executedTaskIds.size : 0,
      isRunning: isRunning
    };

    // Only log if values actually changed
    if (
      prev.currentNodeId !== current.currentNodeId ||
      prev.executedCount !== current.executedCount ||
      prev.isRunning !== current.isRunning ||
      !prev.isRunning // Log on first run
    ) {
      console.log('🎨 [HIGHLIGHT] ExecutionStateProvider - State changed', {
        isRunning,
        hasExecutionState: !!executionState,
        currentNodeId: current.currentNodeId,
        executedCount: current.executedCount,
        currentTaskId: currentTask?.id,
        retrievalState: executionState?.retrievalState
      });
      prevStateRef.current = current;
    }
  }, [isRunning, executionState, currentTask]);

  const isTaskExecuted = React.useCallback((taskId: string): boolean => {
    return executionState?.executedTaskIds.has(taskId) ?? false;
  }, [executionState]);

  const isNodeExecuting = React.useCallback((nodeId: string): boolean => {
    return executionState?.currentNodeId === nodeId;
  }, [executionState]);

  const isRowExecuting = React.useCallback((rowId: string): boolean => {
    if (!currentTask || !executionState) return false;
    return currentTask.source.rowId === rowId && executionState.currentNodeId === currentTask.source.nodeId;
  }, [currentTask, executionState]);

  const getRowStepType = React.useCallback((rowId: string): 'stepStart' | 'stepMatch' | 'stepNoMatch' | null => {
    if (!currentTask || !executionState) return null;

    // Check if this row is currently executing
    if (currentTask.source.rowId !== rowId) return null;

    // Get step type from currentTask source
    const stepType = currentTask.source.stepType;

    // If stepType is 'start', return stepStart
    if (stepType === 'start' || stepType === 'Normal') {
      return 'stepStart';
    }

    // Check retrieval state to determine match/noMatch
    // If retrievalState is 'saturated' or 'confirmed', it's a match
    if (executionState.retrievalState === 'saturated' || executionState.retrievalState === 'confirmed') {
      return 'stepMatch';
    }

    // If retrievalState is 'asrNoMatch', it's noMatch
    if (executionState.retrievalState === 'asrNoMatch') {
      return 'stepNoMatch';
    }

    // For other step types, try to infer from stepType
    if (stepType === 'noMatch') {
      return 'stepNoMatch';
    }

    if (stepType === 'success' || stepType === 'confirmation') {
      return 'stepMatch';
    }

    // Default: return stepStart if we're executing but can't determine
    return 'stepStart';
  }, [currentTask, executionState]);

  const value: ExecutionHighlightState = {
    executionState,
    currentTask,
    isRunning,
    isTaskExecuted,
    isNodeExecuting,
    isRowExecuting,
    getRowStepType
  };

  return (
    <ExecutionStateContext.Provider value={value}>
      {children}
    </ExecutionStateContext.Provider>
  );
}

export function useExecutionState(): ExecutionHighlightState | null {
  return useContext(ExecutionStateContext);
}

