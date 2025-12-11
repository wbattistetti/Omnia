// New Flow Orchestrator: Wrapper around new compiler + engine

import React, { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import type { Node, Edge } from 'reactflow';
import type { FlowNode, EdgeData } from '../../Flowchart/types/flowTypes';
import { useDialogueEngine } from '../../DialogueEngine';
// Frontend taskExecutors removed - backend orchestrator handles all task execution
import { taskRepository } from '../../../services/TaskRepository';
import { getTemplateId } from '../../../utils/taskHelpers';
import type { AssembledDDT } from '../../../DialogueDataTemplateBuilder/DDTAssembler/currentDDT.types';
import type { PlayedMessage } from './flowRowPlayer';
import { useDDTTranslations } from '../../../hooks/useDDTTranslations';
import { extractGUIDsFromDDT } from '../../../utils/ddtUtils';
import { useProjectTranslations, ProjectTranslationsContextType } from '../../../context/ProjectTranslationsContext';
import { findOriginalNode } from '../../ActEditor/ResponseEditor/ChatSimulator/messageResolvers';
import { loadContract } from '../../DialogueDataEngine/contracts/contractLoader';
import { extractWithContractSync } from '../../DialogueDataEngine/contracts/contractExtractor';

interface UseNewFlowOrchestratorProps {
  nodes: Node<FlowNode>[];
  edges: Edge<EdgeData>[];
  onMessage?: (message: PlayedMessage) => void;
  onDDTStart?: (ddt: AssembledDDT) => void;
  onDDTComplete?: () => void;
}

// Safe hook to use ProjectTranslations if available, otherwise return empty translations
const useProjectTranslationsSafe = (): ProjectTranslationsContextType => {
  try {
    return useProjectTranslations();
  } catch (e) {
    // ProjectTranslationsProvider not available - return safe defaults
    // This allows useNewFlowOrchestrator to work even when rendered outside the provider tree
    return {
      translations: {},
      addTranslation: () => {},
      addTranslations: () => {},
      getTranslation: () => undefined,
      loadAllTranslations: async () => {},
      saveAllTranslations: async () => {},
      isDirty: false
    };
  }
};

/**
 * New Flow Orchestrator using compiler + engine
 * Maintains same API as old useFlowOrchestrator for backward compatibility
 */
export function useNewFlowOrchestrator({
  nodes,
  edges,
  onMessage,
  onDDTStart,
  onDDTComplete
}: UseNewFlowOrchestratorProps) {
  // Get task from repository
  const getTask = useCallback((taskId: string) => {
    const task = taskRepository.getTask(taskId);
    if (!task) {
      // Debug: log all available tasks and check if task exists with different lookup
      const allTasks = taskRepository.getAllTasks();
      const taskExists = allTasks.some(t => t.id === taskId);
      console.error(`[useNewFlowOrchestrator] Task not found: ${taskId}`, {
        taskId,
        taskExistsInArray: taskExists,
        totalTasksInMemory: allTasks.length,
        availableTaskIds: allTasks.map(t => ({ id: t.id, action: t.action })), // All tasks with action
        taskIdLength: taskId.length,
        matchingTasks: allTasks.filter(t => t.id.includes(taskId.slice(0, 20))).map(t => t.id), // Partial matches
        nodeIdFromTaskId: taskId.split('-').slice(0, 5).join('-') // First part (node ID)
      });
    }
    return task;
  }, []);

  // ✅ MIGRATION: Use getTemplateId() helper
  // Get DDT from task (for GetData tasks)
  const getDDT = useCallback((taskId: string): AssembledDDT | null => {
    const task = taskRepository.getTask(taskId);
    if (!task) return null;
    const templateId = getTemplateId(task);
    if (templateId !== 'GetData') {
      return null;
    }
    return task.value?.ddt || null;
  }, []);

  // Track current DDT
  const [currentDDTState, setCurrentDDTState] = useState<AssembledDDT | null>(null);

  // Debug: log when currentDDTState changes
  React.useEffect(() => {
    console.log('[useNewFlowOrchestrator] currentDDTState changed', {
      hasDDT: !!currentDDTState,
      ddtId: currentDDTState?.id,
      ddtLabel: currentDDTState?.label
    });
  }, [currentDDTState]);

  // ✅ Get global translations from context (safe - handles missing provider)
  const { translations: globalTranslations } = useProjectTranslationsSafe();

  // ✅ Load translations for current DDT from global table (for state tracking)
  const ddtTranslations = useDDTTranslations(currentDDTState);

  // Helper function to load translations from a DDT (can be called in callbacks, not a hook)
  const loadTranslationsFromDDT = useCallback((ddt: AssembledDDT | null | undefined): Record<string, string> => {
    if (!ddt) {
      return {};
    }

    const guids = extractGUIDsFromDDT(ddt);
    if (guids.length === 0) {
      return {};
    }

    const translationsFromGlobal: Record<string, string> = {};
    const foundGuids: string[] = [];
    const missingGuids: string[] = [];

    guids.forEach(guid => {
      const translation = globalTranslations[guid];
      if (translation) {
        translationsFromGlobal[guid] = translation;
        foundGuids.push(guid);
      } else {
        missingGuids.push(guid);
      }
    });

    // Removed verbose logging

    return translationsFromGlobal;
  }, [globalTranslations]);

  // 🔍 DEBUG: Log translations loading
  useEffect(() => {
    console.log('[useNewFlowOrchestrator][TRANSLATIONS] Translations loaded', {
      hasDDT: !!currentDDTState,
      ddtId: currentDDTState?.id,
      ddtLabel: currentDDTState?.label,
      translationsCount: Object.keys(ddtTranslations).length,
      sampleTranslations: Object.entries(ddtTranslations).slice(0, 5).map(([k, v]) => ({
        key: k,
        value: String(v).substring(0, 50)
      })),
      allTranslationKeys: Object.keys(ddtTranslations)
    });
  }, [currentDDTState, ddtTranslations]);

  // Use ref to store current DDT for async callbacks (avoids stale closure)
  const currentDDTRef = React.useRef<AssembledDDT | null>(null);

  // Use ref to store translations for async callbacks
  const translationsRef = React.useRef<Record<string, string>>({});

  // Update translations ref when translations change
  useEffect(() => {
    translationsRef.current = ddtTranslations;
    console.log('[useNewFlowOrchestrator][TRANSLATIONS] Updated translationsRef', {
      translationsCount: Object.keys(ddtTranslations).length,
      sampleKeys: Object.keys(ddtTranslations).slice(0, 5)
    });
  }, [ddtTranslations]);

  // Store DDT in closure for onGetRetrieveEvent callback
  let currentDDTInClosure: AssembledDDT | null = null;

  // Track pending user input for DDT navigation
  // ✅ Use useRef instead of useState for immediate availability (no async state update)
  const pendingInputResolveRef = React.useRef<((event: any) => void) | null>(null);
  const [currentNodeForInput, setCurrentNodeForInput] = useState<any>(null);
  const [isRetrieving, setIsRetrieving] = useState(false); // Track if retrieve is in progress

  // Ref to expose onUserInputProcessed callback to DDEBubbleChat
  const onUserInputProcessedRef = React.useRef<((input: string, matchStatus: 'match' | 'noMatch' | 'partialMatch') => void) | null>(null);
  // Ref to expose onUserInputProcessed with extracted values
  const onUserInputProcessedWithValuesRef = React.useRef<((input: string, matchStatus: 'match' | 'noMatch' | 'partialMatch', extractedValues?: any[]) => void) | null>(null);

  // Execute task callback - REMOVED: Backend orchestrator handles all task execution
  // This callback is no longer called when backend orchestrator is active (default)
  const handleTaskExecute = useCallback(async (task: any) => {
    console.warn('[useNewFlowOrchestrator] handleTaskExecute called but frontend task execution is disabled');
    console.warn('Backend orchestrator handles all task execution via SSE');
    return { success: false, error: new Error('Frontend task execution has been removed') };
  }, [onMessage, onDDTStart, loadTranslationsFromDDT]);

  // Track DDT state when GetData task is executed
  const handleTaskExecuteWithDDT = useCallback(async (task: any) => {
    const result = await handleTaskExecute(task);

    // ✅ MIGRATION: Use getTemplateId() helper
    // Track DDT state (task is already marked as WaitingUserInput by executor)
    const templateId = getTemplateId(task);
    if (templateId === 'GetData' && result.ddt) {
      setCurrentDDTState(result.ddt);
    }

    return result;
  }, [handleTaskExecute]);

  // Check if backend orchestrator is enabled
  const useBackendOrchestrator = React.useMemo(() => {
    try {
      // Default to backend - only use frontend if explicitly disabled
      const flag = localStorage.getItem('orchestrator.useBackend');
      return flag !== 'false'; // Default to true if not set
    } catch {
      return true; // Default to backend on error
    }
  }, []);

  // Store orchestrator session ID for input handling
  const orchestratorSessionIdRef = React.useRef<string | null>(null);

  // Use new dialogue engine
  const engine = useDialogueEngine({
    nodes,
    edges,
    getTask,
    getDDT,
    onTaskExecute: handleTaskExecuteWithDDT,
    translations: { ...globalTranslations, ...ddtTranslations }, // Pass merged translations to engine
    onMessage: (message) => {
      // Messages from backend orchestrator - forward to onMessage callback
      if (onMessage) {
        import('../chatSimulatorUtils').then(({ getStepColor }) => {
          const messagePayload = {
            id: message.id || message.taskId || `msg-${Date.now()}-${Math.random()}`,
            text: message.text,
            stepType: message.stepType || 'message',
            escalationNumber: message.escalationNumber,
            timestamp: new Date(),
            color: message.stepType ? getStepColor(message.stepType) : undefined,
            warningMessage: undefined
          };
          onMessage(messagePayload);
        }).catch((error) => {
          console.error('[useNewFlowOrchestrator] Error importing getStepColor', error);
          const fallbackPayload = {
            id: message.id || message.taskId || `msg-${Date.now()}-${Math.random()}`,
            text: message.text,
            stepType: message.stepType || 'message',
            escalationNumber: message.escalationNumber,
            timestamp: new Date()
          };
          if (onMessage) {
            onMessage(fallbackPayload);
          }
        });
      }
    },
    onDDTStart: (data) => {
      // DDT start from backend orchestrator - replicate frontend logic exactly
      const ddt = data.ddt || data;
      if (ddt) {
        console.log('[useNewFlowOrchestrator] onDDTStart from backend orchestrator', {
          ddtId: ddt.id,
          ddtLabel: ddt.label
        });
        // Update both state, ref, and closure variable immediately (same as frontend)
        setCurrentDDTState(ddt);
        currentDDTRef.current = ddt;
        currentDDTInClosure = ddt;
        if (onDDTStart) {
          onDDTStart(ddt);
          console.log('[useNewFlowOrchestrator] DDT sent to onDDTStart callback');
        } else {
          console.warn('[useNewFlowOrchestrator] onDDTStart callback not provided');
        }
      }
    },
    onWaitingForInput: (data) => {
      // Store waiting state for input handling
      console.log('[useNewFlowOrchestrator] Waiting for input from backend orchestrator', data);

      // Store session ID - try multiple sources
      // PRIORITY ORDER CHANGED: orchestratorControl.sessionId is most up-to-date
      let sessionIdFound = false;

      // 1. Try from engine.orchestratorControl.sessionId FIRST (most reliable for backend orchestrator)
      const orchestratorControl = (engine as any).orchestratorControl;
      if (orchestratorControl && orchestratorControl.sessionId) {
        orchestratorSessionIdRef.current = orchestratorControl.sessionId;
        sessionIdFound = true;
        console.log('[useNewFlowOrchestrator] ✅ Session ID stored from engine.orchestratorControl', { sessionId: orchestratorControl.sessionId });
      }

      // 2. Try from engine.getSessionId() if available
      if (!sessionIdFound && typeof (engine as any).getSessionId === 'function') {
        const sessionId = (engine as any).getSessionId();
        if (sessionId) {
          orchestratorSessionIdRef.current = sessionId;
          sessionIdFound = true;
          console.log('[useNewFlowOrchestrator] ✅ Session ID stored from engine.getSessionId()', { sessionId });
        }
      }

      // 3. Try from engine.sessionId (fallback, may be stale)
      if (!sessionIdFound) {
        const engineSessionId = (engine as any).sessionId;
        if (engineSessionId) {
          orchestratorSessionIdRef.current = engineSessionId;
          sessionIdFound = true;
          console.log('[useNewFlowOrchestrator] ⚠️ Session ID stored from engine.sessionId (may be stale!)', { sessionId: engineSessionId });
        }
      }

      if (!sessionIdFound) {
        console.warn('[useNewFlowOrchestrator] ⚠️ Could not find sessionId from any source!', {
          hasOrchestratorControl: !!orchestratorControl,
          hasSessionIdInControl: !!orchestratorControl?.sessionId,
          hasGetSessionId: typeof (engine as any).getSessionId === 'function',
          engineKeys: Object.keys(engine || {})
        });
      }

      // If DDT is provided, call onDDTStart to replicate frontend behavior exactly
      if (data.ddt) {
        console.log('[useNewFlowOrchestrator] DDT provided in waitingForInput, calling onDDTStart', {
          ddtId: data.ddt.id,
          ddtLabel: data.ddt.label
        });
        // Replicate exact frontend logic: set state, ref, closure, and call callback
        setCurrentDDTState(data.ddt);
        currentDDTRef.current = data.ddt;
        currentDDTInClosure = data.ddt;
        if (onDDTStart) {
          onDDTStart(data.ddt);
          console.log('[useNewFlowOrchestrator] DDT sent to onDDTStart callback from waitingForInput');
        }
      }
    },
    onComplete: () => {
      if (onDDTComplete) {
        onDDTComplete();
      }
    },
    onError: (error) => {
      console.error('[useNewFlowOrchestrator] Error:', error);
    }
  });

  // Store session ID when available (check multiple sources)
  React.useEffect(() => {
    if (useBackendOrchestrator) {
      // Try to get sessionId from engine
      const engineSessionId = (engine as any).sessionId;
      if (engineSessionId) {
        orchestratorSessionIdRef.current = engineSessionId;
        console.log('[useNewFlowOrchestrator] Backend orchestrator session ID stored from engine', {
          sessionId: orchestratorSessionIdRef.current
        });
        return;
      }

      // Try to get from orchestratorControl
      const orchestratorControl = (engine as any).orchestratorControl;
      if (orchestratorControl && orchestratorControl.sessionId) {
        orchestratorSessionIdRef.current = orchestratorControl.sessionId;
        console.log('[useNewFlowOrchestrator] Backend orchestrator session ID stored from orchestratorControl', {
          sessionId: orchestratorSessionIdRef.current
        });
      }
    }
  }, [useBackendOrchestrator, (engine as any).sessionId, (engine as any).orchestratorControl]);

      // ✅ Expose execution state to window for FlowEditor highlighting
      // ✅ Expose onMessage to window for edge error messages
      const prevStateRef = React.useRef<{ currentNodeId?: string | null; executedCount?: number; isRunning?: boolean }>({});
      React.useEffect(() => {
        try {
          (window as any).__executionState = engine.executionState;
          (window as any).__currentTask = engine.currentTask;
          (window as any).__isRunning = engine.isRunning;
          // Expose onMessage for edge error messages
          if (onMessage) {
            (window as any).__flowOnMessage = onMessage;
          }

      // 🎨 [HIGHLIGHT] Log when execution state changes (only when values change)
      const prev = prevStateRef.current;
      const current = {
        currentNodeId: engine.executionState?.currentNodeId,
        executedCount: engine.executionState?.executedTaskIds.size || 0,
        isRunning: engine.isRunning
      };

      if (
        engine.isRunning && (
          prev.currentNodeId !== current.currentNodeId ||
          prev.executedCount !== current.executedCount ||
          prev.isRunning !== current.isRunning ||
          !prev.isRunning || // Log on first run
          !engine.executionState // Log when state is first initialized
        )
      ) {
        console.log('🎨 [HIGHLIGHT] useNewFlowOrchestrator - State changed', {
          isRunning: engine.isRunning,
          hasExecutionState: !!engine.executionState,
          currentNodeId: current.currentNodeId,
          executedCount: current.executedCount,
          currentTaskId: engine.currentTask?.id
        });
        prevStateRef.current = current;
      }
    } catch (error) {
      console.warn('🎨 [HIGHLIGHT] Failed to expose execution state to window', error);
    }
  }, [engine.executionState, engine.currentTask, engine.isRunning]);

  // Expose same API as old orchestrator
  return {
    // State
    currentNodeId: engine.executionState?.currentNodeId || null,
    currentActIndex: engine.executionState?.currentRowIndex || 0,
    isRunning: engine.isRunning,
    currentDDT: currentDDTState,
    currentTask: engine.currentTask, // Expose current task (may be WaitingUserInput)
    activeContext: null, // TODO: Track active context if needed
    variableStore: engine.executionState?.variableStore || {},
    error: null, // TODO: Track errors
    isRetrieving, // Expose isRetrieving state
    onUserInputProcessedRef, // Expose ref for DDEBubbleChat to set callback
    onUserInputProcessedWithValuesRef, // Expose ref for passing extracted values

    // Actions
    start: engine.start,
    stop: engine.stop,
    reset: () => {
      if (engine.reset) {
        engine.reset();
      }
      setCurrentDDTState(null);
    },
    nextAct: () => {
      // Next act is handled automatically by engine
      console.log('[useNewFlowOrchestrator] nextAct called - handled by engine');
    },
    getCurrentNode: () => {
      const nodeId = engine.executionState?.currentNodeId;
      if (!nodeId) return undefined;
      return nodes.find(n => n.id === nodeId);
    },
    drainSequentialNonInteractiveFrom: () => {
      // Not needed in new system - handled by compiler
      return { emitted: false, nextIndex: 0, nextDDT: null, nextContext: null, messages: [] };
    },
    drainInitialMessages: () => {
      // Not needed in new system - handled by compiler
      return { messages: [], nextIndex: 0, nextDDT: null, nextContext: null };
    },
    updateVariableStore: (updater: any) => {
      // TODO: Implement variable store update
      console.log('[useNewFlowOrchestrator] updateVariableStore called');
    },
    setCurrentDDT: (ddt: AssembledDDT | null) => {
      setCurrentDDTState(ddt);
    },
    updateCurrentActIndex: (index: number) => {
      // Not needed in new system
      console.log('[useNewFlowOrchestrator] updateCurrentActIndex called');
    },
    onDDTCompleted: (retrievalState?: any) => {
      setCurrentDDTState(null);
      // Find task in WaitingUserInput and mark as Executed
      const waitingTask = engine.currentTask;
      if (waitingTask && waitingTask.state === 'WaitingUserInput') {
        // Complete waiting task: marks as Executed, updates retrievalState, resumes loop
        if (engine.completeWaitingTask) {
          engine.completeWaitingTask(waitingTask.id, retrievalState || 'saturated');
        }
      }
      if (onDDTComplete) {
        onDDTComplete();
      }
    },
    handleUserInput: async (input: string) => {
      const t0 = performance.now();
      console.log('[useNewFlowOrchestrator] 📥 handleUserInput called', {
        input: input.substring(0, 50),
        hasPendingResolve: !!pendingInputResolveRef.current,
        useBackendOrchestrator,
        hasSessionId: !!orchestratorSessionIdRef.current
      });

      // If using backend orchestrator, send input to backend
      if (useBackendOrchestrator) {
        // Try to get sessionId from multiple sources (in order of preference)
        let sessionId = orchestratorSessionIdRef.current;

        if (!sessionId) {
          // Try from engine.sessionId (exposed directly)
          sessionId = engine.sessionId || (engine as any).sessionId;
          if (sessionId) {
            console.log('[useNewFlowOrchestrator] Found sessionId from engine.sessionId', { sessionId });
          }
        }

        if (!sessionId) {
          // Try from engine.getSessionId() if available
          if (engine.getSessionId && typeof engine.getSessionId === 'function') {
            sessionId = engine.getSessionId();
            if (sessionId) {
              console.log('[useNewFlowOrchestrator] Found sessionId from engine.getSessionId()', { sessionId });
            }
          }
        }

        if (!sessionId) {
          // Try from orchestratorControl (fallback)
          const orchestratorControl = (engine as any).orchestratorControl;
          sessionId = orchestratorControl?.sessionId;
          if (sessionId) {
            console.log('[useNewFlowOrchestrator] Found sessionId from orchestratorControl', { sessionId });
          }
        }

        if (sessionId) {
          // Update ref for next time
          orchestratorSessionIdRef.current = sessionId;
          console.log('[useNewFlowOrchestrator] 📤 Sending input to backend orchestrator', {
            sessionId,
            inputLength: input.length,
            input: input.substring(0, 50)
          });
          try {
            const { provideOrchestratorInput } = await import('../../DialogueEngine/orchestratorAdapter');
            const result = await provideOrchestratorInput(sessionId, input);
            if (!result.success) {
              console.error('[useNewFlowOrchestrator] Failed to provide input to backend orchestrator', result.error);
            } else {
              console.log('[useNewFlowOrchestrator] ✅ Input successfully sent to backend orchestrator');
            }
          } catch (error) {
            console.error('[useNewFlowOrchestrator] Error providing input to backend orchestrator', error);
          }
          return;
        } else {
          console.error('[useNewFlowOrchestrator] ⚠️ Backend orchestrator enabled but no sessionId available!', {
            hasOrchestratorSessionIdRef: !!orchestratorSessionIdRef.current,
            hasEngineSessionId: !!(engine.sessionId || (engine as any).sessionId),
            hasGetSessionId: typeof engine.getSessionId === 'function',
            hasOrchestratorControl: !!(engine as any).orchestratorControl,
            engineKeys: Object.keys(engine || {}).slice(0, 10)
          });
        }
      }

      // Frontend orchestrator: handle input for DDT navigation
      if (pendingInputResolveRef.current) {
        setIsRetrieving(true);
        const t1 = performance.now();
        const resolve = pendingInputResolveRef.current;
        pendingInputResolveRef.current = null;
        resolve({ type: 'match' as const, value: input });
        setCurrentNodeForInput(null);
        const t2 = performance.now();
      } else {
        console.warn('[useNewFlowOrchestrator] handleUserInput called but no pendingInputResolve');
      }
    }
  };
}

