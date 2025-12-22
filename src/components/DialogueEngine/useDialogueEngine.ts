// React hook for Dialogue Engine

import { useState, useCallback, useRef } from 'react';
import type { Node, Edge } from 'reactflow';
import type { FlowNode, EdgeData } from '../Flowchart/types/flowTypes';
import type { CompiledTask, CompilationResult, ExecutionState } from '../FlowCompiler/types';
// Frontend DialogueEngine removed - backend orchestrator is now default
import { taskRepository } from '../../services/TaskRepository';
import { getTemplateId } from '../../utils/taskHelpers';

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

      // Collect only referenced tasks from node rows (not all tasks in repository)
      const referencedTaskIds = new Set<string>();
      enrichedNodes.forEach(node => {
        const rows = node.data?.rows || [];
        rows.forEach(row => {
          // Use row.taskId if present, otherwise fallback to row.id
          const taskId = row.taskId || row.id;
          if (taskId) {
            referencedTaskIds.add(taskId);
          }
        });
      });

      // Collect only referenced tasks from repository
      const allTasks = Array.from(referencedTaskIds)
        .map(taskId => taskRepository.getTask(taskId))
        .filter(task => task !== undefined);

      // Extract DDTs only from referenced GetData tasks
      // ✅ MIGRATION: Use getTemplateId() helper
      const allDDTs: any[] = [];
      allTasks.forEach(task => {
        const templateId = getTemplateId(task);
        // ✅ CASE-INSENSITIVE
        // ✅ Check if task has DDT (mainData indicates DDT)
        if (templateId && templateId.toLowerCase() === 'getdata' && task.mainData && task.mainData.length > 0) {
          allDDTs.push({
            label: task.label,
            mainData: task.mainData,
            stepPrompts: task.stepPrompts,
            constraints: task.constraints,
            examples: task.examples
          });
        }
      });

      const totalTasksInRepository = taskRepository.getAllTasks().length;
      console.log('[FRONTEND] Preparing compilation request:', {
        nodesCount: enrichedNodes.length,
        edgesCount: options.edges.length,
        tasksCount: allTasks.length,
        referencedTaskIdsCount: referencedTaskIds.size,
        totalTasksInRepository,
        ddtsCount: allDDTs.length
      });

      if (totalTasksInRepository > allTasks.length) {
        console.log(`[FRONTEND] ⚠️ Filtered out ${totalTasksInRepository - allTasks.length} unused tasks from repository`);
      }

      // Get base URL from localStorage (React: localhost:3100, VB.NET: localhost:5000)
      const backendType = (() => {
        try {
          const stored = localStorage.getItem('omnia_backend_type');
          return stored === 'vbnet' ? 'vbnet' : 'react';
        } catch {
          return 'react';
        }
      })();
      const baseUrl = backendType === 'vbnet' ? 'http://localhost:5000' : 'http://localhost:3100';

      // Transform nodes from ReactFlow structure (data.rows) to simplified structure (rows directly)
      // VB.NET backend expects: { id, label, rows: [...] } (no data wrapper)
      const { transformNodesToSimplified } = await import('../../flows/flowTransformers');

      // 🔍 DEBUG: Log all rows before transformation
      console.log('═══════════════════════════════════════════════════════════════════════════');
      console.log('🔍 [FRONTEND] Nodes BEFORE transformation:');
      enrichedNodes.forEach((node, idx) => {
        const rows = node.data?.rows || [];
        console.log(`  Node[${idx}]:`, {
          nodeId: node.id,
          label: node.data?.label || '',
          rowsCount: rows.length,
          rows: rows.map((r: any) => ({
            id: r.id,
            text: r.text,
            included: r.included,
            taskId: r.taskId,
            type: r.type,
            mode: r.mode
          }))
        });
      });
      console.log('═══════════════════════════════════════════════════════════════════════════');

      const simplifiedNodes = transformNodesToSimplified(enrichedNodes);

      // 🔍 DEBUG: Log all rows after transformation
      console.log('═══════════════════════════════════════════════════════════════════════════');
      console.log('🔍 [FRONTEND] Nodes AFTER transformation:');
      simplifiedNodes.forEach((node, idx) => {
        console.log(`  Node[${idx}]:`, {
          nodeId: node.id,
          label: node.label || '',
          rowsCount: node.rows?.length || 0,
          rows: node.rows?.map((r: any) => ({
            id: r.id,
            text: r.text,
            included: r.included,
            taskId: r.taskId,
            type: r.type,
            mode: r.mode
          })) || []
        });
      });
      console.log('═══════════════════════════════════════════════════════════════════════════');

      // Call backend API (NO FALLBACK - backend only)
      const compileResponse = await fetch(`${baseUrl}/api/runtime/compile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          nodes: simplifiedNodes,  // ✅ Use simplified structure (rows directly, no data wrapper)
          edges: options.edges,
          tasks: allTasks,
          ddts: allDDTs,
          projectId: localStorage.getItem('currentProjectId') || undefined
        })
      });

      console.log(`[FRONTEND] Response status: ${compileResponse.status} ${compileResponse.statusText}`);
      console.log(`[FRONTEND] Response headers:`, Object.fromEntries(compileResponse.headers.entries()));

      if (!compileResponse.ok) {
        const errorText = await compileResponse.text().catch(() => 'Unable to read error response');
        console.error(`[FRONTEND] ❌ Backend compilation failed (${compileResponse.status}):`, errorText);
        let errorData: any = { error: 'Unknown error' };
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText || 'Unknown error' };
        }
        throw new Error(`Backend compilation failed: ${errorData.message || errorData.error || errorData.detail || compileResponse.statusText}`);
      }

      const responseText = await compileResponse.text();
      console.log(`[FRONTEND] Response body length: ${responseText.length} characters`);
      console.log(`[FRONTEND] Response body preview:`, responseText.substring(0, 200));

      if (!responseText || responseText.trim().length === 0) {
        throw new Error('Backend returned empty response');
      }

      let compileData: any;
      try {
        compileData = JSON.parse(responseText);
      } catch (parseError) {
        console.error(`[FRONTEND] ❌ Failed to parse JSON response:`, parseError);
        console.error(`[FRONTEND] Response text:`, responseText);
        throw new Error(`Failed to parse backend response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
      }

      // Log original JSON from compiler
      console.log('[FRONTEND] ✅ Compilation data received:', {
        hasTaskGroups: !!compileData.taskGroups,
        taskGroupsCount: compileData.taskGroups?.length || 0,
        entryTaskGroupId: compileData.entryTaskGroupId,
        tasksCount: compileData.tasks?.length || 0
      });

      // Convert taskMap from object back to Map (for frontend use only)
      const taskMap = new Map<string, CompiledTask>();
      if (compileData.taskMap) {
        Object.entries(compileData.taskMap).forEach(([key, value]) => {
          taskMap.set(key, value as CompiledTask);
        });
      }

      // Create CompilationResult for frontend use (if needed)
      const compilationResult: CompilationResult = {
        tasks: compileData.tasks || [],
        entryTaskId: compileData.entryTaskId || compileData.entryTaskGroupId || null, // Support both entryTaskId and entryTaskGroupId
        taskMap,
        // Preserve VB.NET backend fields
        taskGroups: compileData.taskGroups || undefined,
        entryTaskGroupId: compileData.entryTaskGroupId || null
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
      console.log('   └─ TaskGroups:', compileData.taskGroups?.length || 0);
      console.log('   └─ EntryTaskGroupId:', compileData.entryTaskGroupId);
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

        // Pass original JSON from compiler directly to orchestrator (no transformation!)
        const orchestratorControl = await executeOrchestratorBackend(
          compileData, // ✅ Pass original JSON - preserves taskGroups, entryTaskGroupId, etc.
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
        // Frontend DialogueEngine removed - backend orchestrator is now default
        // To use frontend, restore from git history
        console.error('❌ [ORCHESTRATOR] Frontend DialogueEngine has been removed. Backend orchestrator is now default.');
        console.error('   Set localStorage.setItem("orchestrator.useBackend", "false") is no longer supported.');
        setIsRunning(false);
        setCurrentTask(null);
        options.onError?.(new Error('Frontend DialogueEngine has been removed. Backend orchestrator is required.'));
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

