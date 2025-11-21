// New Flow Orchestrator: Wrapper around new compiler + engine

import React, { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import type { Node, Edge } from 'reactflow';
import type { NodeData, EdgeData } from '../../Flowchart/types/flowTypes';
import { useDialogueEngine } from '../../DialogueEngine';
import { executeTask } from '../../DialogueEngine/taskExecutors';
import { taskRepository } from '../../../services/TaskRepository';
import type { AssembledDDT } from '../../../DialogueDataTemplateBuilder/DDTAssembler/currentDDT.types';
import type { PlayedMessage } from './flowRowPlayer';
import { useDDTTranslations } from '../../../hooks/useDDTTranslations';
import { extractGUIDsFromDDT } from '../../../utils/ddtUtils';
import { useProjectTranslations, ProjectTranslationsContextType } from '../../../context/ProjectTranslationsContext';
import { findOriginalNode } from '../../ActEditor/ResponseEditor/ChatSimulator/messageResolvers';
import { loadContract } from '../../DialogueDataEngine/contracts/contractLoader';
import { extractWithContractSync } from '../../DialogueDataEngine/contracts/contractExtractor';

interface UseNewFlowOrchestratorProps {
  nodes: Node<NodeData>[];
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

  // Get DDT from task (for GetData tasks)
  const getDDT = useCallback((taskId: string): AssembledDDT | null => {
    const task = taskRepository.getTask(taskId);
    if (!task || task.action !== 'GetData') {
      return null;
    }
    return task.value?.ddt || null;
  }, []);

  // Track current DDT
  const [currentDDTState, setCurrentDDTState] = useState<AssembledDDT | null>(null);

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

    console.log('[useNewFlowOrchestrator][loadTranslationsFromDDT] 🔍 Loaded translations from DDT', {
      ddtId: ddt.id,
      ddtLabel: ddt.label,
      requestedGuids: guids.length,
      foundTranslations: foundGuids.length,
      missingGuids: missingGuids.length,
      sampleKeys: Object.keys(translationsFromGlobal).slice(0, 5),
      sampleTranslations: Object.entries(translationsFromGlobal).slice(0, 3).map(([k, v]) => ({
        key: k,
        value: String(v).substring(0, 50)
      }))
    });

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
  const [pendingInputResolve, setPendingInputResolve] = useState<((event: any) => void) | null>(null);
  const [currentNodeForInput, setCurrentNodeForInput] = useState<any>(null);
  const [isRetrieving, setIsRetrieving] = useState(false); // Track if retrieve is in progress

  // Ref to expose onUserInputProcessed callback to DDEBubbleChat
  const onUserInputProcessedRef = React.useRef<((input: string, matchStatus: 'match' | 'noMatch' | 'partialMatch') => void) | null>(null);
  // Ref to expose onUserInputProcessed with extracted values
  const onUserInputProcessedWithValuesRef = React.useRef<((input: string, matchStatus: 'match' | 'noMatch' | 'partialMatch', extractedValues?: any[]) => void) | null>(null);

  // Execute task callback
  const handleTaskExecute = useCallback(async (task: any) => {
    // 🔍 Extract DDT from task and load translations immediately (don't wait for state update)
    const taskDDT: AssembledDDT | null = task.value?.ddt || null;
    const taskTranslations = loadTranslationsFromDDT(taskDDT);

    console.log('[useNewFlowOrchestrator][handleTaskExecute] Starting', {
      taskId: task.id,
      action: task.action,
      hasOnMessage: !!onMessage,
      hasOnDDTStart: !!onDDTStart,
      hasTaskDDT: !!taskDDT,
      taskDDTId: taskDDT?.id,
      taskDDTLabel: taskDDT?.label,
      // 🔍 DEBUG: Log translations loaded from task DDT
      hasTranslations: Object.keys(taskTranslations).length > 0,
      translationsCount: Object.keys(taskTranslations).length,
      sampleTranslationKeys: Object.keys(taskTranslations).slice(0, 5),
      sampleTranslations: Object.entries(taskTranslations).slice(0, 3).map(([k, v]) => ({
        key: k,
        value: String(v).substring(0, 50)
      }))
    });
    const result = await executeTask(task, {
      onMessage: (text: string, stepType?: string, escalationNumber?: number) => {
        console.log('[useNewFlowOrchestrator][handleTaskExecute] ═══════════════════════════════════════');
        console.log('[useNewFlowOrchestrator][handleTaskExecute] 🔔 onMessage CALLBACK RECEIVED FROM DDT');
        console.log('[useNewFlowOrchestrator][handleTaskExecute] ═══════════════════════════════════════');
        console.log('[useNewFlowOrchestrator][handleTaskExecute] onMessage called', {
          text: text?.substring(0, 100),
          fullText: text,
          taskId: task.id,
          stepType,
          escalationNumber,
          hasOnMessageParent: !!onMessage
        });
        if (onMessage) {
          // Import getStepColor dynamically
          import('../chatSimulatorUtils').then(({ getStepColor }) => {
            onMessage({
              id: task.id, // Use task GUID directly - no need to generate new ID
              text,
              stepType: stepType || 'message',
              escalationNumber,
              timestamp: new Date(),
              color: stepType ? getStepColor(stepType) : undefined
            });
            console.log('[useNewFlowOrchestrator][handleTaskExecute] Message sent to onMessage callback');
          }).catch((error) => {
            console.error('[useNewFlowOrchestrator][handleTaskExecute] Error importing getStepColor', error);
            // Fallback: send message without color
            onMessage({
              id: task.id,
              text,
              stepType: stepType || 'message',
              escalationNumber,
              timestamp: new Date()
            });
          });
        } else {
          console.warn('[useNewFlowOrchestrator][handleTaskExecute] onMessage callback not provided');
        }
      },
      onDDTStart: (ddt) => {
        console.log('[useNewFlowOrchestrator][handleTaskExecute] onDDTStart called', { taskId: task.id, hasDDT: !!ddt });
        // Update both state, ref, and closure variable immediately
        setCurrentDDTState(ddt);
        currentDDTRef.current = ddt;
        currentDDTInClosure = ddt; // Update closure variable
        if (onDDTStart) {
          onDDTStart(ddt);
          console.log('[useNewFlowOrchestrator][handleTaskExecute] DDT sent to onDDTStart callback');
        } else {
          console.warn('[useNewFlowOrchestrator][handleTaskExecute] onDDTStart callback not provided');
        }
      },
      onBackendCall: async (config) => {
        // TODO: Implement backend call
        console.log('[useNewFlowOrchestrator] Backend call:', config);
        return {};
      },
      onProblemClassify: async (intents, ddt) => {
        // TODO: Implement problem classification
        console.log('[useNewFlowOrchestrator] Problem classify:', intents);
        return { variables: {}, retrievalState: 'saturated' };
      },
      onGetRetrieveEvent: async (nodeId: string, ddtParam?: AssembledDDT) => {
        // Use DDT passed as parameter first (most reliable), then closure variable, then ref, then state
        const ddt = ddtParam || currentDDTInClosure || currentDDTRef.current || currentDDTState;
        console.log('[useNewFlowOrchestrator] onGetRetrieveEvent called', {
          nodeId,
          hasCurrentDDT: !!ddt,
          hasDDTParam: !!ddtParam,
          source: ddtParam ? 'parameter' : (currentDDTInClosure ? 'closure' : (currentDDTRef.current ? 'ref' : 'state'))
        });

        // Reset isRetrieving when waiting for new input (retrieve completed)
        setIsRetrieving(false);

        // Wait for user input - return promise that resolves when user provides input
        return new Promise((resolve) => {
          console.log('[useNewFlowOrchestrator] Setting up pending input resolve', { nodeId });
          setPendingInputResolve(() => resolve);
          // Store current node for input processing
          if (ddt) {
            // DDT can have mainData as array, single object, or in different structure
            let mainData = Array.isArray(ddt.mainData) ? ddt.mainData[0] : ddt.mainData;

            // If mainData is not found, try alternative structures
            if (!mainData) {
              // Try to find mainData in alternative locations
              if ((ddt as any).nodes && Array.isArray((ddt as any).nodes)) {
                // DDT might have nodes array instead of mainData
                mainData = (ddt as any).nodes.find((n: any) => n.id === nodeId) || (ddt as any).nodes[0];
              }
            }

            if (!mainData) {
              console.warn('[useNewFlowOrchestrator] DDT has no mainData', {
                ddtKeys: Object.keys(ddt),
                ddtId: ddt.id,
                ddtLabel: ddt.label,
                hasMainData: !!ddt.mainData,
                mainDataType: typeof ddt.mainData,
                isMainDataArray: Array.isArray(ddt.mainData),
                nodeId
              });
              // Still set up the resolve, but without node info
              return;
            }
            const findNode = (node: any, id: string): any => {
              if (!node) return null;
              if (node.id === id) return node;
              if (node.subData && Array.isArray(node.subData)) {
                for (const sub of node.subData) {
                  const found = findNode(sub, id);
                  if (found) return found;
                }
              }
              return null;
            };
            const node = findNode(mainData, nodeId) || mainData;
            console.log('[useNewFlowOrchestrator] Found node for input', { nodeId, found: !!node, nodeLabel: node?.label, hasMainData: !!mainData });
            setCurrentNodeForInput(node);
          } else {
            console.warn('[useNewFlowOrchestrator] No DDT when onGetRetrieveEvent called');
          }
          // Input will be provided via handleUserInput
          // Return raw input as 'match' event - will be processed in retrieve()
        });
      },
      onUserInputProcessed: (input: string, matchStatus: 'match' | 'noMatch' | 'partialMatch', extractedValues?: any[]) => {
        // This callback is called from ddtRetrieve after processing input
        // We'll expose it via a ref so DDEBubbleChat can listen to it
        console.log('[useNewFlowOrchestrator] User input processed', { input, matchStatus, extractedValues });
        // Store in a ref that DDEBubbleChat can access
        if (onUserInputProcessedRef.current) {
          onUserInputProcessedRef.current(input, matchStatus);
        }
        // Also call the callback with extracted values if available
        if (onUserInputProcessedWithValuesRef.current && extractedValues) {
          // Enhance extracted values with linguistic values from input text
          const enhancedValues = extractedValues.map(ev => {
            let linguisticValue = ev.linguisticValue;
            if (!linguisticValue) {
              // Try to find linguistic value in input
              const semanticStr = String(ev.semanticValue);
              if (ev.variable === 'month' && typeof ev.semanticValue === 'number' && ev.semanticValue >= 1 && ev.semanticValue <= 12) {
                const monthNames = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
                const monthName = monthNames[ev.semanticValue - 1];
                if (input.toLowerCase().includes(monthName)) {
                  linguisticValue = monthName;
                } else if (input.includes(semanticStr)) {
                  linguisticValue = semanticStr;
                }
              } else if (input.includes(semanticStr)) {
                linguisticValue = semanticStr;
              }
            }
            return { ...ev, linguisticValue };
          });
          onUserInputProcessedWithValuesRef.current(input, matchStatus, enhancedValues);
        }
      },
      onProcessInput: async (input: string, node: any) => {
        console.log('[useNewFlowOrchestrator] Processing input', {
          input,
          nodeId: node?.id,
          nodeLabel: node?.label,
          nodeKind: node?.kind,
          hasTaskDDT: !!taskDDT
        });

        // ✅ USA LO STESSO METODO DEL RESPONSE EDITOR: Contract invece di extractField
        try {
          // ✅ WORKAROUND: Il node V2 non ha nlpContract
          // Recupera il nodo originale dal DDT (come fa il Response Editor)
          let originalNode: any = null;
          if (taskDDT) {
            originalNode = findOriginalNode(taskDDT, node?.label, node?.id);
            console.log('[useNewFlowOrchestrator] Found original node', {
              hasOriginalNode: !!originalNode,
              originalNodeId: originalNode?.id,
              originalNodeLabel: originalNode?.label,
              hasNlpContract: !!(originalNode as any)?.nlpContract
            });
          }

          // ✅ USA IL CONTRACT (come fa il Response Editor)
          const contract = originalNode ? loadContract(originalNode) : null;

          if (contract && contract.templateName === node?.kind) {
            console.log('[useNewFlowOrchestrator] ✅ Contract trovato, usando per estrazione', {
              templateName: contract.templateName,
              contractTemplateId: contract.templateId,
              input: input.substring(0, 50)
            });

            // ✅ Estrai usando il Contract (stesso metodo del Response Editor)
            const result = extractWithContractSync(input, contract, undefined);

            if (result.hasMatch && Object.keys(result.values).length > 0) {
              console.log('[useNewFlowOrchestrator] ✅ Extraction SUCCESS', {
                values: result.values,
                source: result.source,
                valuesCount: Object.keys(result.values).length
              });
              return { status: 'match' as const, value: result.values };
            } else {
              console.log('[useNewFlowOrchestrator] ❌ No match from contract', {
                input: input.substring(0, 50),
                contractPatterns: contract.regex.patterns.length
              });
              return { status: 'noMatch' as const };
            }
          } else {
            console.warn('[useNewFlowOrchestrator] ⚠️ Contract non trovato, fallback a extractField', {
              hasOriginalNode: !!originalNode,
              hasContract: !!contract,
              nodeKind: node?.kind,
              contractTemplateName: contract?.templateName
            });

            // ✅ FALLBACK: Se non c'è Contract, usa extractField (per compatibilità)
            const { extractField } = await import('../../../nlp/pipeline');
            const fieldName = node?.label || node?.name || '';

            const subData = originalNode?.subData || node?.subData || [];
            const nlpProfile = originalNode?.nlpProfile || node?.nlpProfile;

            const context = {
              node: {
                subData: subData,
                subSlots: subData,
                kind: originalNode?.kind || node?.kind,
                label: originalNode?.label || node?.label,
                nlpProfile: nlpProfile
              },
              regex: nlpProfile?.regex,
              onWaitingMessage: (message: string) => {
                if (onMessage) {
                  onMessage({
                    id: `waiting-${Date.now()}-${Math.random()}`,
                    text: message,
                    stepType: 'waiting',
                    timestamp: new Date()
                  });
                }
              }
            };

            const extractionResult = await extractField(fieldName, input, undefined, context);

            if (extractionResult.status === 'accepted') {
              return { status: 'match' as const, value: extractionResult.value };
            } else if (extractionResult.status === 'ask-more') {
              return { status: 'partialMatch' as const, value: extractionResult.value };
            } else {
              return { status: 'noMatch' as const };
            }
          }
        } catch (error) {
          console.error('[useNewFlowOrchestrator] Error processing input', error);
          return { status: 'noMatch' as const };
        }
      },
      // ✅ Pass translations loaded directly from task DDT (not from state)
      translations: taskTranslations
    });

    return result;
  }, [onMessage, onDDTStart, loadTranslationsFromDDT]);

  // Track DDT state when GetData task is executed
  const handleTaskExecuteWithDDT = useCallback(async (task: any) => {
    const result = await handleTaskExecute(task);

    // Track DDT state (task is already marked as WaitingUserInput by executor)
    if (task.action === 'GetData' && result.ddt) {
      setCurrentDDTState(result.ddt);
    }

    return result;
  }, [handleTaskExecute]);

  // Use new dialogue engine
  const engine = useDialogueEngine({
    nodes,
    edges,
    getTask,
    getDDT,
    onTaskExecute: handleTaskExecuteWithDDT,
    onComplete: () => {
      if (onDDTComplete) {
        onDDTComplete();
      }
    },
    onError: (error) => {
      console.error('[useNewFlowOrchestrator] Error:', error);
    }
  });

  // ✅ Expose execution state to window for FlowEditor highlighting
  const prevStateRef = React.useRef<{ currentNodeId?: string | null; executedCount?: number; isRunning?: boolean }>({});
  React.useEffect(() => {
    try {
      (window as any).__executionState = engine.executionState;
      (window as any).__currentTask = engine.currentTask;
      (window as any).__isRunning = engine.isRunning;

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
      console.log('[useNewFlowOrchestrator] handleUserInput called', {
        input,
        hasPendingResolve: !!pendingInputResolve,
        hasCurrentNode: !!currentNodeForInput
      });
      // Handle user input for DDT navigation
      if (pendingInputResolve) {
        // Set isRetrieving to true when processing starts
        setIsRetrieving(true);

        // Return raw input as 'match' event - will be processed in retrieve() using onProcessInput
        // This allows retrieve() to process the input and determine if it's actually match/noMatch
        console.log('[useNewFlowOrchestrator] Resolving pending input', { input });
        pendingInputResolve({ type: 'match' as const, value: input });
        setPendingInputResolve(null);
        setCurrentNodeForInput(null);
      } else {
        console.warn('[useNewFlowOrchestrator] handleUserInput called but no pendingInputResolve');
      }
    }
  };
}

