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
  onMessage?: (message: { id: string; text: string; stepType?: string; escalationNumber?: number; taskId?: string }) => void;
  onDDTStart?: (data: { ddt: any; taskId: string }) => void;
  onWaitingForInput?: (data: { taskId: string; nodeId?: string }) => void;
  translations?: Record<string, string>; // Add translations support
}

export function useDialogueEngine(options: UseDialogueEngineOptions) {
  const [executionState, setExecutionState] = useState<ExecutionState | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [currentTask, setCurrentTask] = useState<CompiledTask | null>(null);
  const engineRef = useRef<DialogueEngine | null>(null);
  const sessionIdRef = useRef<string | null>(null); // Store sessionId in a ref for real-time access

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

      // ═══════════════════════════════════════════════════════════════════════════
      // 🚀 FLOW ORCHESTRATOR - EXECUTION LOCATION TRACKING
      // ═══════════════════════════════════════════════════════════════════════════
      console.log('═══════════════════════════════════════════════════════════════════════════');
      console.log('🚀 [FLOW ORCHESTRATOR] Starting Execution');
      console.log('═══════════════════════════════════════════════════════════════════════════');
      console.log('');
      console.log('📊 [ARCHITECTURE SUMMARY]');
      console.log('');
      console.log('✅ [COMPILATION] Location: BACKEND');
      console.log('   └─ Endpoint: POST /api/runtime/compile');
      console.log('   └─ Compiler: backend/runtime/compiler/compiler.ts');
      console.log('   └─ Status: COMPLETED');
      console.log('   └─ CompiledBy:', compileData.compiledBy || 'BACKEND_RUNTIME');
      console.log('');

      // Check if we should use backend orchestrator
      const useBackendOrchestrator = (() => {
        try {
          // Default to backend - only use frontend if explicitly disabled
          const flag = localStorage.getItem('orchestrator.useBackend');
          return flag !== 'false'; // Default to true if not set
        } catch {
          return true; // Default to backend on error
        }
      })();

      if (useBackendOrchestrator) {
        console.log('✅ [ORCHESTRATOR] Location: BACKEND');
        console.log('   └─ Endpoint: POST /api/runtime/orchestrator/session/start');
        console.log('   └─ Engine: backend/runtime/orchestrator/engine.ts');
        console.log('   └─ Communication: SSE (Server-Sent Events)');
        console.log('   └─ Status: USING BACKEND ✅');
        console.log('');
        console.log('✅ [DDT ENGINE] Location: BACKEND');
        console.log('   └─ Endpoint: POST /api/runtime/ddt/session/start');
        console.log('   └─ Engine: backend/runtime/ddt/ddtEngine.ts');
        console.log('   └─ Called: When GetData task executes');
        console.log('');
        console.log('📝 [CURRENT STATE]');
        console.log('   • Compilation: BACKEND ✅');
        console.log('   • Orchestrator: BACKEND ✅');
        console.log('   • DDT Engine: BACKEND ✅');
        console.log('═══════════════════════════════════════════════════════════════════════════');

        // Use backend orchestrator via SSE
        const { executeOrchestratorBackend } = await import('./orchestratorAdapter');

        // Get translations - prefer from options, fallback to global context
        let translations: Record<string, string> = {};

        // 1. Try from options (most reliable, passed from useNewFlowOrchestrator)
        if (options.translations && Object.keys(options.translations).length > 0) {
          translations = options.translations;
          console.log('[useDialogueEngine] ✅ Using translations from options', {
            translationsCount: Object.keys(translations).length,
            sampleKeys: Object.keys(translations).slice(0, 5)
          });
        } else {
          // 2. Fallback: Try to get from window or context
          try {
            const globalTranslations = (window as any).__globalTranslations || {};
            Object.assign(translations, globalTranslations);
            console.log('[useDialogueEngine] ⚠️ Using translations from window (fallback)', {
              translationsCount: Object.keys(translations).length
            });
          } catch (e) {
            console.warn('[useDialogueEngine] ⚠️ Could not load translations from any source', e);
          }
        }

        const orchestratorControl = await executeOrchestratorBackend(
          compilationResult,
          allTasks,
          allDDTs,
          translations,
          {
            onMessage: (message) => {
              // Messages from backend orchestrator - forward to onMessage callback
              console.log('[useDialogueEngine] Message from backend orchestrator', {
                messageId: message.id,
                text: message.text?.substring(0, 50),
                stepType: message.stepType,
                taskId: message.taskId
              });
              if (options.onMessage) {
                options.onMessage(message);
              }
            },
            onDDTStart: (data) => {
              // DDT start from backend orchestrator
              const ddt = data.ddt || data;
              console.log('[useDialogueEngine] DDT start from backend orchestrator', {
                ddtId: ddt?.id,
                ddtLabel: ddt?.label,
                taskId: data.taskId
              });
              // Forward to options.onDDTStart if provided
              if (options.onDDTStart && ddt) {
                options.onDDTStart({ ddt, taskId: data.taskId });
              }
            },
            onStateUpdate: (state) => {
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
            },
            onWaitingForInput: (data) => {
              // Store waiting state for input handling
              console.log('[useDialogueEngine] onWaitingForInput called from backend orchestrator', {
                hasDDT: !!data.ddt,
                ddtId: data.ddt?.id,
                taskId: data.taskId,
                nodeId: data.nodeId
              });
              (engineRef.current as any).waitingForInput = data;

              // Update sessionId in engineRef to keep it fresh
              if (orchestratorControl && orchestratorControl.sessionId) {
                sessionIdRef.current = orchestratorControl.sessionId;
                if (engineRef.current) {
                  (engineRef.current as any).sessionId = orchestratorControl.sessionId;
                }
                console.log('[useDialogueEngine] ✅ Refreshed sessionId in onWaitingForInput', {
                  sessionId: orchestratorControl.sessionId
                });
              }

              // Forward to options.onWaitingForInput if provided
              if (options.onWaitingForInput) {
                console.log('[useDialogueEngine] Forwarding onWaitingForInput to options callback');
                options.onWaitingForInput(data);
              } else {
                console.warn('[useDialogueEngine] ⚠️ options.onWaitingForInput not provided!');
              }
            }
          }
        );

        // Store orchestrator control for stop/cleanup
        if (!engineRef.current) {
          engineRef.current = {} as any;
        }
        (engineRef.current as any).orchestratorControl = orchestratorControl;
        (engineRef.current as any).sessionId = orchestratorControl.sessionId;
        sessionIdRef.current = orchestratorControl.sessionId; // Store in ref for real-time access
        console.log('[useDialogueEngine] ✅ Backend orchestrator session ID stored', {
          sessionId: orchestratorControl.sessionId,
          hasOrchestratorControl: !!(engineRef.current as any).orchestratorControl,
          engineRefKeys: Object.keys(engineRef.current || {})
        });

        return; // Backend orchestrator handles execution
      } else {
        console.log('⚠️  [ORCHESTRATOR] Location: FRONTEND (Browser)');
        console.log('   └─ Engine: DialogueEngine (FRONTEND VERSION)');
        console.log('   └─ File: src/components/DialogueEngine/engine.ts');
        console.log('   └─ Task Loop: Runs in browser');
        console.log('   └─ Note: Set localStorage.setItem("orchestrator.useBackend", "true") to use backend');
        console.log('');
        console.log('✅ [DDT ENGINE] Location: BACKEND');
        console.log('   └─ Endpoint: POST /api/runtime/ddt/session/start');
        console.log('   └─ Engine: backend/runtime/ddt/ddtEngine.ts');
        console.log('   └─ Called: When GetData task executes');
        console.log('');
        console.log('📝 [CURRENT STATE]');
        console.log('   • Compilation: BACKEND ✅');
        console.log('   • Orchestrator: FRONTEND ⚠️');
        console.log('   • DDT Engine: BACKEND ✅');
        console.log('═══════════════════════════════════════════════════════════════════════════');

        // Use frontend DialogueEngine (existing behavior)
        const engine = new DialogueEngine(compilationResult, {
          onTaskExecute: async (task) => {
            console.log('[FRONTEND][DialogueEngine] Executing task', {
              taskId: task.id,
              action: task.action,
              executedBy: 'FRONTEND_DIALOGUE_ENGINE',
              location: 'BROWSER'
            });
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
      }
    } catch (error) {
      setIsRunning(false);
      setCurrentTask(null);
      options.onError?.(error as Error);
    }
  }, [isRunning, options]);

  // Stop execution
  const stop = useCallback(() => {
    // Check if using backend orchestrator
    const orchestratorControl = (engineRef.current as any)?.orchestratorControl;
    if (orchestratorControl && orchestratorControl.stop) {
      orchestratorControl.stop();
    } else if (engineRef.current && typeof engineRef.current.stop === 'function') {
      engineRef.current.stop();
    }
    setIsRunning(false);
    setCurrentTask(null);
  }, []);

  // Reset engine state
  const reset = useCallback(() => {
    // Check if using backend orchestrator
    const orchestratorControl = (engineRef.current as any)?.orchestratorControl;
    if (orchestratorControl && orchestratorControl.stop) {
      orchestratorControl.stop();
    } else if (engineRef.current && typeof engineRef.current.reset === 'function') {
      engineRef.current.reset();
    }
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

  // Expose sessionId getter for backend orchestrator (uses ref for real-time access)
  const getSessionId = useCallback(() => {
    return sessionIdRef.current || (engineRef.current as any)?.sessionId || null;
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
    updateRetrievalState,
    getSessionId, // Expose getter for sessionId
    sessionId: sessionIdRef.current || (engineRef.current as any)?.sessionId || null // Also expose directly for easier access
  };
}

