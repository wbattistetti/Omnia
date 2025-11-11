// New Flow Orchestrator: Wrapper around new compiler + engine

import React, { useCallback, useMemo, useState } from 'react';
import type { Node, Edge } from 'reactflow';
import type { NodeData, EdgeData } from '../../Flowchart/types/flowTypes';
import { useDialogueEngine } from '../../DialogueEngine';
import { executeTask } from '../../DialogueEngine/taskExecutors';
import { taskRepository } from '../../../services/TaskRepository';
import type { AssembledDDT } from '../../../DialogueDataTemplateBuilder/DDTAssembler/currentDDT.types';
import type { PlayedMessage } from './flowRowPlayer';

interface UseNewFlowOrchestratorProps {
  nodes: Node<NodeData>[];
  edges: Edge<EdgeData>[];
  onMessage?: (message: PlayedMessage) => void;
  onDDTStart?: (ddt: AssembledDDT) => void;
  onDDTComplete?: () => void;
}

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

  // Use ref to store current DDT for async callbacks (avoids stale closure)
  const currentDDTRef = React.useRef<AssembledDDT | null>(null);

  // Store DDT in closure for onGetRetrieveEvent callback
  let currentDDTInClosure: AssembledDDT | null = null;

  // Track pending user input for DDT navigation
  const [pendingInputResolve, setPendingInputResolve] = useState<((event: any) => void) | null>(null);
  const [currentNodeForInput, setCurrentNodeForInput] = useState<any>(null);
  const [isRetrieving, setIsRetrieving] = useState(false); // Track if retrieve is in progress

  // Ref to expose onUserInputProcessed callback to DDEBubbleChat
  const onUserInputProcessedRef = React.useRef<((input: string, matchStatus: 'match' | 'noMatch' | 'partialMatch') => void) | null>(null);

  // Execute task callback
  const handleTaskExecute = useCallback(async (task: any) => {
    console.log('[useNewFlowOrchestrator][handleTaskExecute] Starting', {
      taskId: task.id,
      action: task.action,
      hasOnMessage: !!onMessage,
      hasOnDDTStart: !!onDDTStart
    });
    const result = await executeTask(task, {
      onMessage: (text: string, stepType?: string, escalationNumber?: number) => {
        console.log('[useNewFlowOrchestrator][handleTaskExecute] onMessage called', {
          text,
          taskId: task.id,
          stepType,
          escalationNumber
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
      onUserInputProcessed: (input: string, matchStatus: 'match' | 'noMatch' | 'partialMatch') => {
        // This callback is called from ddtRetrieve after processing input
        // We'll expose it via a ref so DDEBubbleChat can listen to it
        console.log('[useNewFlowOrchestrator] User input processed', { input, matchStatus });
        // Store in a ref that DDEBubbleChat can access
        if (onUserInputProcessedRef.current) {
          onUserInputProcessedRef.current(input, matchStatus);
        }
      },
      onProcessInput: async (input: string, node: any) => {
        console.log('[useNewFlowOrchestrator] Processing input', {
          input,
          nodeId: node?.id,
          nodeLabel: node?.label,
          nodeKind: node?.kind,
          hasNlpProfile: !!node?.nlpProfile,
          regex: node?.nlpProfile?.regex
        });

        // Process input using NLP extraction
        try {
          const { extractField } = await import('../../../nlp/pipeline');
          const fieldName = node?.label || node?.name || '';

          // Build extraction context with waiting messages callback
          const context = {
            node: {
              subData: node?.subData || [],
              kind: node?.kind,
              label: node?.label,
              nlpProfile: node?.nlpProfile // Passa tutto il nlpProfile per accedere a waitingEsc1/2
            },
            regex: node?.nlpProfile?.regex,
            onWaitingMessage: (message: string) => {
              // Mostra messaggio waiting durante escalation
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

          console.log('[useNewFlowOrchestrator] Calling extractField', {
            fieldName,
            input,
            hasRegex: !!context.regex,
            regex: context.regex,
            hasWaitingEsc1: !!node?.nlpProfile?.waitingEsc1,
            hasWaitingEsc2: !!node?.nlpProfile?.waitingEsc2
          });

          const extractionResult = await extractField(fieldName, input, undefined, context);

          console.log('[useNewFlowOrchestrator] Extraction result', {
            status: extractionResult.status,
            hasValue: !!extractionResult.value,
            value: extractionResult.value
          });

          if (extractionResult.status === 'accepted') {
            return { status: 'match' as const, value: extractionResult.value };
          } else if (extractionResult.status === 'ask-more') {
            return { status: 'partialMatch' as const, value: extractionResult.value };
          } else if (extractionResult.status === 'reject') {
            // Regex matched but validation failed - treat as noMatch
            console.log('[useNewFlowOrchestrator] Input rejected - returning noMatch', {
              input,
              status: extractionResult.status,
              reasons: (extractionResult as any).reasons,
              fieldName
            });
            return { status: 'noMatch' as const };
          } else {
            console.log('[useNewFlowOrchestrator] Input did not match - returning noMatch', {
              input,
              status: extractionResult.status,
              fieldName
            });
            return { status: 'noMatch' as const };
          }
        } catch (error) {
          console.error('[useNewFlowOrchestrator] Error processing input', error);
          return { status: 'noMatch' as const };
        }
      }
    });

    return result;
  }, [onMessage, onDDTStart]);

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

