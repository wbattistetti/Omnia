// React hook for Dialogue Engine

import { useState, useCallback, useRef } from 'react';
import type { Node, Edge } from 'reactflow';
import type { NodeData, EdgeData } from '../Flowchart/types/flowTypes';
import type { CompiledTask, CompilationResult, ExecutionState } from '../FlowCompiler/types';
import { DialogueEngine } from './engine';
import { taskRepository } from '../../services/TaskRepository';

interface UseDialogueEngineOptions {
  nodes: Node<NodeData>[];
  edges: Edge<EdgeData>[];
  getTask: (taskId: string) => any;
  getDDT?: (taskId: string) => any;
  onTaskExecute: (task: CompiledTask) => Promise<any>;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

export function useDialogueEngine(options: UseDialogueEngineOptions) {
  const [executionState, setExecutionState] = useState<ExecutionState | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [currentTask, setCurrentTask] = useState<CompiledTask | null>(null);
  const engineRef = useRef<DialogueEngine | null>(null);

  // 🎨 [HIGHLIGHT] Ref to track previous state for logging
  const prevStateRef = useRef<{ currentNodeId?: string | null; executedCount?: number }>({});

  // Expose currentTask for useNewFlowOrchestrator
  const getCurrentTask = useCallback(() => currentTask, [currentTask]);

  // Start execution - compiles flow only when Start is clicked
  const start = useCallback(async () => {
    if (isRunning) {
      console.warn('[useDialogueEngine] Already running');
      return;
    }

    setIsRunning(true);

    try {
      // Ensure all tasks exist in memory before compilation
      // Enrich all rows with taskId (creates tasks in memory if missing)
      const { enrichRowsWithTaskId } = await import('../../utils/taskHelpers');
      const enrichedNodes = options.nodes.map(node => {
        if (node.data?.rows) {
          // Enrich rows and update node.data.rows with enriched version
          const enrichedRows = enrichRowsWithTaskId(node.data.rows);
          return {
            ...node,
            data: {
              ...node.data,
              rows: enrichedRows
            }
          };
        }
        return node;
      });

      // Compile flow HERE, only when Start is clicked
      // ✅ DEBUG: Log edges passed to compiler
      const elseEdgesCount = options.edges.filter(e => e.data?.isElse === true).length;
      if (elseEdgesCount > 0) {
        console.log('[useDialogueEngine][start] ✅ Else edges found before compilation', {
          elseEdgesCount,
          totalEdgesCount: options.edges.length,
          elseEdges: options.edges.filter(e => e.data?.isElse === true).map(e => ({
            id: e.id,
            label: e.label,
            source: e.source,
            target: e.target,
            hasData: !!e.data,
            isElse: e.data?.isElse,
            dataKeys: e.data ? Object.keys(e.data) : []
          }))
        });
      }

      // ═══════════════════════════════════════════════════════════════════════════
      // 🚀 CALL BACKEND COMPILER API
      // ═══════════════════════════════════════════════════════════════════════════
      console.log('═══════════════════════════════════════════════════════════════════════════');
      console.log('🚀 [FRONTEND] Calling backend compiler API...');
      console.log('═══════════════════════════════════════════════════════════════════════════');

      // Collect all tasks and ddts
      const allTasks = taskRepository.getAllTasks();
      const allDDTs: any[] = [];

      // Extract DDTs from GetData tasks
      allTasks.forEach(task => {
        if (task.action === 'GetData' && task.value?.ddt) {
          allDDTs.push(task.value.ddt);
        }
      });

      console.log('[FRONTEND] Preparing compilation request:', {
        nodesCount: enrichedNodes.length,
        edgesCount: options.edges.length,
        tasksCount: allTasks.length,
        ddtsCount: allDDTs.length
      });

      // Call backend API (NO FALLBACK - backend only)
      const compileResponse = await fetch('http://localhost:3100/api/runtime/compile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          nodes: enrichedNodes,
          edges: options.edges,
          tasks: allTasks,
          ddts: allDDTs,
          projectId: localStorage.getItem('currentProjectId') || undefined
        })
      });

      if (!compileResponse.ok) {
        const errorData = await compileResponse.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`Backend compilation failed: ${errorData.message || errorData.error || compileResponse.statusText}`);
      }

      const compileData = await compileResponse.json();

      console.log('═══════════════════════════════════════════════════════════════════════════');
      console.log('✅ [FRONTEND] Backend compiler API response received');
      console.log('[FRONTEND] Compilation result:', {
        tasksCount: compileData.tasks?.length || 0,
        entryTaskId: compileData.entryTaskId,
        compiledBy: compileData.compiledBy || 'UNKNOWN',
        timestamp: compileData.timestamp
      });

      // ✅ Verify backend compiler was used
      if (compileData.compiledBy === 'BACKEND_RUNTIME') {
        console.log('✅ [FRONTEND] ✅ CONFIRMED: Backend Runtime Compiler was used!');
      } else {
        console.warn('⚠️ [FRONTEND] WARNING: compiledBy flag missing or incorrect:', compileData.compiledBy);
      }
      console.log('═══════════════════════════════════════════════════════════════════════════');

      // Convert taskMap from object back to Map
      const taskMap = new Map<string, CompiledTask>();
      if (compileData.taskMap) {
        Object.entries(compileData.taskMap).forEach(([key, value]) => {
          taskMap.set(key, value as CompiledTask);
        });
      }

      const compilationResult: CompilationResult = {
        tasks: compileData.tasks || [],
        entryTaskId: compileData.entryTaskId || null,
        taskMap
      };

      const engine = new DialogueEngine(compilationResult, {
        onTaskExecute: async (task) => {
          setCurrentTask(task);
          return await options.onTaskExecute(task);
        },
        onStateUpdate: (state) => {
          // 🎨 [HIGHLIGHT] Log only when state actually changes (reduced noise)
          const prev = prevStateRef.current;
          const current = {
            currentNodeId: state.currentNodeId,
            executedCount: state.executedTaskIds.size
          };

          if (
            prev.currentNodeId !== current.currentNodeId ||
            prev.executedCount !== current.executedCount ||
            !prev.currentNodeId // Log on first update
          ) {
            console.log('🎨 [HIGHLIGHT] useDialogueEngine - State updated', {
              currentNodeId: current.currentNodeId,
              executedCount: current.executedCount
            });
            prevStateRef.current = current;
          }

          setExecutionState(state);
        },
        onComplete: () => {
          setIsRunning(false);
          setCurrentTask(null);
          options.onComplete?.();
        },
        onError: (error) => {
          setIsRunning(false);
          setCurrentTask(null);
          options.onError?.(error);
        }
      });

      engineRef.current = engine;
      await engine.start();
    } catch (error) {
      setIsRunning(false);
      setCurrentTask(null);
      options.onError?.(error as Error);
    }
  }, [isRunning, options]);

  // Stop execution
  const stop = useCallback(() => {
    engineRef.current?.stop();
    setIsRunning(false);
    setCurrentTask(null);
  }, []);

  // Reset engine state
  const reset = useCallback(() => {
    engineRef.current?.reset();
    setIsRunning(false);
    setCurrentTask(null);
    setExecutionState(null);
  }, []);

  // Update retrieval state (for DDT)
  const updateRetrievalState = useCallback((state: any) => {
    engineRef.current?.updateRetrievalState(state);
  }, []);

  // Complete waiting task (e.g., after DDT completion)
  const completeWaitingTask = useCallback((taskId: string, retrievalState?: any) => {
    if (!engineRef.current) {
      console.warn('[useDialogueEngine] No engine instance available');
      return;
    }
    engineRef.current.completeWaitingTask(taskId, retrievalState);
    setIsRunning(true); // Loop will resume automatically
  }, []);

  return {
    executionState,
    isRunning,
    currentTask,
    getCurrentTask,
    start,
    stop,
    reset,
    completeWaitingTask,
    updateRetrievalState
  };
}

