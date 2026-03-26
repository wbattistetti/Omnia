// React hook for Dialogue Engine

import { useState, useCallback, useRef, useEffect } from 'react';
import type { Node, Edge } from 'reactflow';
import type { FlowNode, EdgeData } from '../Flowchart/types/flowTypes';
import type { CompiledTask, CompilationResult, ExecutionState } from '../FlowCompiler/types';
// Frontend DialogueEngine removed - backend orchestrator is now default
import { useProjectData } from '../../context/ProjectDataContext';

interface UseDialogueEngineOptions {
  nodes: Node<FlowNode>[];
  edges: Edge<EdgeData>[];
  getTask: (taskId: string) => any;
  getDDT?: (taskId: string) => any;
  onTaskExecute: (task: CompiledTask) => Promise<any>;
  onComplete?: () => void;
  onError?: (error: Error) => void;
  onMessage?: (message: { id: string; text: string; stepType?: string; escalationNumber?: number; taskId?: string }) => void;
  onDDTStart?: (data: { ddt: any; taskId: string }) => void;
  onWaitingForInput?: (data: { taskId: string; nodeId?: string; taskLabel?: string; nodeLabel?: string }) => void;
  translations?: Record<string, string>; // Add translations support
  /** `main` = always compile/run from main + nested subflows; `active` = root = focused canvas + its nested subflows. Override with localStorage `flow.orchestratorRoot`. */
  orchestratorRoot?: 'main' | 'active';
  projectId?: string;
}

/**
 * ✅ ARCHITECTURAL: Stable engine instance pattern
 *
 * This hook maintains a stable engine instance across React Strict Mode remounts by:
 * 1. Storing all options in a ref (optionsRef) - updated via useEffect
 * 2. Using optionsRef.current in all callbacks (never directly from props)
 * 3. Keeping critical state (SSE, sessionId, orchestratorControl) in refs
 * 4. Using useState only for UI-reactive state (executionState, isRunning, currentTask)
 *
 * This ensures:
 * - No engine recreation on remount (hook is always called at same level)
 * - No state loss during React Strict Mode double-invocation
 * - Stable callbacks that don't cause re-renders
 * - Options can be updated without recreating the engine
 */
export function useDialogueEngine(options: UseDialogueEngineOptions) {
  const isGuidLike = useCallback((value: unknown): boolean => {
    const text = String(value || '').trim();
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:-[a-z0-9_-]+)?$/i.test(text);
  }, []);

  const toReadableLabel = useCallback((value: unknown): string => {
    const text = String(value || '').trim();
    if (!text || isGuidLike(text)) {
      return '';
    }
    return text;
  }, [isGuidLike]);

  // ✅ STATE: UI-reactive state (triggers re-renders)
  const [executionState, setExecutionState] = useState<ExecutionState | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [currentTask, setCurrentTask] = useState<CompiledTask | null>(null);
  const isRunningRef = useRef(false);

  // ✅ REFS: Stable state that survives remounts
  const engineRef = useRef<{
    orchestratorControl?: { sessionId: string; stop: () => Promise<void> };
    sessionId?: string;
    waitingForInput?: { taskId: string; nodeId?: string };
  } | null>(null);

  const sessionIdRef = useRef<string | null>(null);
  const prevStateRef = useRef<{ currentNodeId?: string | null; executedCount?: number }>({});

  // ✅ CRITICAL: Store options in ref for stable access in callbacks
  // This ref is updated via useEffect when options change, but the engine instance
  // is never recreated - only the options reference is updated
  const optionsRef = useRef<UseDialogueEngineOptions>(options);

  // ✅ Update options ref when options change (without recreating engine)
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  // ✅ Get projectData for conditions
  const { data: projectData } = useProjectData();

  // Expose currentTask for useNewFlowOrchestrator
  const getCurrentTask = useCallback(() => currentTask, [currentTask]);

  // ✅ STABLE: start callback uses optionsRef, not options directly
  // This ensures callbacks always use the latest options without causing re-renders
  const start = useCallback(async () => {
    // ✅ Always read from ref to get latest options (survives remount)
    const currentOptions = optionsRef.current;

    if (isRunningRef.current) {
      return;
    }

    isRunningRef.current = true;
    setIsRunning(true);

    try {
      // ✅ Use currentOptions from ref throughout (all compilation logic)
      // Ensure all tasks exist in memory before compilation
      // Enrich all rows with taskId (creates tasks in memory if missing)
      // Root canvas + transitive subflow compilations (snapshot); entry graph = rootFlowId compilation
      const { compileWorkspaceForOrchestratorSession } = await import('./compileWorkspaceOrchestratorSession');
      const { FlowWorkspaceSnapshot } = await import('../../flows/FlowWorkspaceSnapshot');
      const { normalizeSeverity } = await import('../../utils/severityUtils');

      let translations: Record<string, string> = {};
      if (currentOptions.translations && Object.keys(currentOptions.translations).length > 0) {
        translations = currentOptions.translations;
      } else {
        try {
          Object.assign(
            translations,
            (window as unknown as { __globalTranslations?: Record<string, string> }).__globalTranslations || {}
          );
        } catch {
          /* noop */
        }
      }

      const orchestratorRoot: 'main' | 'active' =
        currentOptions.orchestratorRoot ??
        ((): 'main' | 'active' => {
          try {
            const v = localStorage.getItem('flow.orchestratorRoot');
            if (v === 'main' || v === 'active') return v;
          } catch {
            /* noop */
          }
          return 'active';
        })();

      const rootFlowId = orchestratorRoot === 'main' ? 'main' : FlowWorkspaceSnapshot.getActiveFlowId();

      const workspaceResult = await compileWorkspaceForOrchestratorSession({
        rootFlowId,
        projectData,
        translations,
        fallback: { nodes: currentOptions.nodes, edges: currentOptions.edges },
      });

      const {
        primaryCompileJson,
        mergedTasks: allTasksWithTemplates,
        mergedDDTs: allDDTs,
        subflowCompilations,
        allCompileSlices,
      } = workspaceResult;
      const taskLabelById = new Map<string, string>();
      for (const taskItem of allTasksWithTemplates) {
        const taskId = String(taskItem?.id || '').trim();
        if (!taskId) continue;
        const readable = toReadableLabel(taskItem?.label || taskItem?.text || taskItem?.title);
        if (readable) {
          taskLabelById.set(taskId, readable);
        }
      }
      const nodeLabelById = new Map<string, string>();
      for (const node of currentOptions.nodes || []) {
        const nodeId = String((node as any)?.id || '').trim();
        if (!nodeId) continue;
        const readable = toReadableLabel((node as any)?.data?.label || (node as any)?.label || (node as any)?.title);
        if (readable) {
          nodeLabelById.set(nodeId, readable);
        }
      }

      const multiFlow = allCompileSlices.length > 1;
      const mergedErrorList: Array<Record<string, unknown>> = [];
      for (const slice of allCompileSlices) {
        const errs = slice.errors;
        if (!errs?.length) continue;
        for (const err of errs) {
          if (err && typeof err === 'object') {
            const o = err as Record<string, unknown>;
            const baseMsg = String(o.message ?? o.Message ?? 'Compilation issue');
            mergedErrorList.push({
              ...o,
              message: multiFlow ? `[${slice.flowId}] ${baseMsg}` : baseMsg,
            });
          } else {
            mergedErrorList.push({
              message: multiFlow ? `[${slice.flowId}] ${String(err)}` : String(err),
              severity: 'Error',
            });
          }
        }
      }

      const compileData: Record<string, unknown> = { ...primaryCompileJson };
      if (mergedErrorList.length > 0) {
        compileData.errors = mergedErrorList;
        compileData.hasErrors = mergedErrorList.some((e) => normalizeSeverity(e.severity) === 'error');
      }

      // Convert taskMap from object back to Map (for frontend use only)
      const taskMap = new Map<string, CompiledTask>();
      if (compileData.taskMap) {
        Object.entries(compileData.taskMap).forEach(([key, value]) => {
          taskMap.set(key, value as CompiledTask);
        });
      }

      // Create CompilationResult for frontend use (if needed)
      const compilationResult: CompilationResult = {
        tasks: (compileData.tasks as CompilationResult['tasks']) || [],
        entryTaskId: compileData.entryTaskId || compileData.entryTaskGroupId || null, // Support both entryTaskId and entryTaskGroupId
        taskMap,
        // Preserve VB.NET backend fields
        taskGroups: compileData.taskGroups || undefined,
        entryTaskGroupId: compileData.entryTaskGroupId || null,
        // ✅ Error handling
        errors: compileData.errors || undefined,
        hasErrors: compileData.hasErrors || false
      };

      // ✅ Check for blocking errors BEFORE starting orchestrator
      if (compilationResult.errors && compilationResult.errors.length > 0) {
        // ✅ Store errors in context IMMEDIATELY (reactive React state)
        // Use global setter that can be called from async callbacks
        try {
          const { setCompilationErrorsGlobal } = await import('../../context/CompilationErrorsContext');
          setCompilationErrorsGlobal(compilationResult.errors);
          console.log('[useDialogueEngine] ✅ Errors set in context (reactive):', compilationResult.errors.length);
        } catch (e) {
          console.error('[useDialogueEngine] ❌ Failed to store errors in context:', e);
          // Note: No fallback to window - context should always be available
        }

        // ✅ Normalize severity: backend sends "Error"/"Warning" (PascalCase), frontend expects 'error'/'warning'
        const { normalizeSeverity } = await import('../../utils/severityUtils');
        const blockingErrors = compilationResult.errors.filter(
          e => normalizeSeverity(e.severity) === 'error'
        );

        if (blockingErrors.length > 0) {
          // ✅ Open Error Report Panel automatically
          try {
            const { openErrorReportPanelService } = await import('../../services/ErrorReportPanelService');
            openErrorReportPanelService();
          } catch (e) {
            console.error('[useDialogueEngine] ❌ Failed to open Error Report Panel:', e);
          }

          // ✅ Show user-friendly message in chat
          const { formatCompilationErrorMessage } = await import('../../utils/errorMessageFormatter');
          const errorMessage = formatCompilationErrorMessage(blockingErrors);

          const opts = optionsRef.current;
          if (opts.onMessage) {
            opts.onMessage({
              id: `error-${Date.now()}`,
              text: errorMessage + '\n\n💡 Apri il pannello Error Report per vedere i dettagli e selezionare i nodi con problemi.',
              stepType: 'error',
              taskId: 'SYSTEM'
            });
          }

          // Don't start orchestrator
          isRunningRef.current = false;
          setIsRunning(false);
          setCurrentTask(null);
          opts.onError?.(new Error(`Compilation has ${blockingErrors.length} blocking errors. Fix errors before execution.`));
          return;
        }

        // Only warnings - show info but allow execution
        const { formatCompilationWarningMessage } = await import('../../utils/errorMessageFormatter');
        const warningMessage = formatCompilationWarningMessage(compilationResult.errors);
        const opts = optionsRef.current;
        if (warningMessage && opts.onMessage) {
          opts.onMessage({
            id: `warning-${Date.now()}`,
            text: warningMessage,
            stepType: 'warning',
            taskId: 'SYSTEM'
          });
        }
      }

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
        // Use backend orchestrator via SSE (translations already resolved for compile)
        const { executeOrchestratorBackend } = await import('./orchestratorAdapter');

        const orchestratorControl = await executeOrchestratorBackend(
          compileData,
          allTasksWithTemplates,
          allDDTs,
          translations,
          {
            onMessage: (message) => {
              // ✅ Always use latest options from ref
              const opts = optionsRef.current;
              if (opts.onMessage) {
                opts.onMessage(message);
              }
            },
            onDDTStart: (data) => {
              // ✅ Always use latest options from ref
              const opts = optionsRef.current;
              const ddt = data.ddt || data;
              if (opts.onDDTStart && ddt) {
                opts.onDDTStart({ ddt, taskId: data.taskId });
              }
            },
            onStateUpdate: (state) => {
              setExecutionState(state);
            },
            onComplete: () => {
              isRunningRef.current = false;
              setIsRunning(false);
              setCurrentTask(null);
              const opts = optionsRef.current;
              opts.onComplete?.();
            },
            onError: (error) => {
              isRunningRef.current = false;
              setIsRunning(false);
              setCurrentTask(null);
              const opts = optionsRef.current;
              opts.onError?.(error);
            },
            onWaitingForInput: (data) => {
              // ✅ Store waiting state in ref (survives remount)
              if (!engineRef.current) {
                engineRef.current = {};
              }
              const enrichedWaiting = {
                ...data,
                taskLabel: taskLabelById.get(data.taskId || '') || undefined,
                nodeLabel: data.nodeId ? nodeLabelById.get(data.nodeId) || undefined : undefined,
              };
              engineRef.current.waitingForInput = enrichedWaiting;

              // Update sessionId in ref
              if (orchestratorControl && orchestratorControl.sessionId) {
                sessionIdRef.current = orchestratorControl.sessionId;
                engineRef.current.sessionId = orchestratorControl.sessionId;
              }

              // ✅ Forward using currentOptions from ref (always latest)
              const opts = optionsRef.current;
              if (opts.onWaitingForInput) {
                opts.onWaitingForInput(enrichedWaiting);
              }
            }
          },
          subflowCompilations
        );

        // Store orchestrator control for stop/cleanup
        if (!engineRef.current) {
          engineRef.current = {} as any;
        }
        (engineRef.current as any).orchestratorControl = orchestratorControl;
        (engineRef.current as any).sessionId = orchestratorControl.sessionId;
        sessionIdRef.current = orchestratorControl.sessionId; // Store in ref for real-time access

        return; // Backend orchestrator handles execution
      } else {
        // Frontend DialogueEngine removed - backend orchestrator is now default
        // To use frontend, restore from git history
        console.error('❌ [ORCHESTRATOR] Frontend DialogueEngine has been removed. Backend orchestrator is now default.');
        console.error('   Set localStorage.setItem("orchestrator.useBackend", "false") is no longer supported.');
        isRunningRef.current = false;
        setIsRunning(false);
        setCurrentTask(null);
        const opts = optionsRef.current;
        opts.onError?.(new Error('Frontend DialogueEngine has been removed. Backend orchestrator is required.'));
      }
    } catch (error) {
      isRunningRef.current = false;
      setIsRunning(false);
      setCurrentTask(null);
      const opts = optionsRef.current;
      opts.onError?.(error as Error);
    }
  }, [toReadableLabel]); // ✅ Only stable deps; options come from ref

  // Stop execution
  const stop = useCallback(async () => {
    // Check if using backend orchestrator
    const orchestratorControl = (engineRef.current as any)?.orchestratorControl;
    if (orchestratorControl && orchestratorControl.stop) {
      await orchestratorControl.stop();
    } else if (engineRef.current && typeof engineRef.current.stop === 'function') {
      await engineRef.current.stop();
    }
    if (engineRef.current) {
      engineRef.current.sessionId = undefined;
      engineRef.current.orchestratorControl = undefined;
    }
    sessionIdRef.current = null;
    isRunningRef.current = false;
    setIsRunning(false);
    setCurrentTask(null);
  }, []);

  // Reset engine state
  const reset = useCallback(async () => {
    // Check if using backend orchestrator
    const orchestratorControl = (engineRef.current as any)?.orchestratorControl;
    if (orchestratorControl && orchestratorControl.stop) {
      await orchestratorControl.stop();
    } else if (engineRef.current && typeof engineRef.current.reset === 'function') {
      await engineRef.current.reset();
    }
    if (engineRef.current) {
      engineRef.current.sessionId = undefined;
      engineRef.current.orchestratorControl = undefined;
      engineRef.current.waitingForInput = undefined;
    }
    sessionIdRef.current = null;
    isRunningRef.current = false;
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

  // ✅ ARCHITECTURAL: Provide user input to backend orchestrator
  // Delegates to provideOrchestratorInput with current sessionId
  const provideInput = useCallback(async (input: string) => {
    const currentSessionId = sessionIdRef.current || (engineRef.current as any)?.sessionId;

    if (!currentSessionId) {
      console.error('[useDialogueEngine] ❌ Cannot provide input: no sessionId available');
      throw new Error('No active orchestrator session. Cannot provide input.');
    }

    try {
      const { provideOrchestratorInput } = await import('./orchestratorAdapter');
      const result = await provideOrchestratorInput(currentSessionId, input);

      if (!result.success) {
        throw new Error(result.error || 'Failed to provide input to orchestrator');
      }

      console.log('[useDialogueEngine] ✅ Input provided successfully to backend orchestrator', {
        sessionId: currentSessionId,
        inputLength: input.length
      });
    } catch (error) {
      console.error('[useDialogueEngine] ❌ Error providing input to orchestrator', error);
      throw error;
    }
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
    sessionId: sessionIdRef.current || (engineRef.current as any)?.sessionId || null, // Also expose directly for easier access
    provideInput // ✅ Expose method to provide user input
  };
}

