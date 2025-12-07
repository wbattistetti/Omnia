// Orchestrator Adapter - Frontend
// Uses backend orchestrator via SSE instead of local DialogueEngine

import type { CompilationResult } from '../FlowCompiler/types';
import type { ExecutionState } from '../FlowCompiler/types';

export interface OrchestratorCallbacks {
  onMessage?: (message: { id: string; text: string; stepType?: string; escalationNumber?: number; taskId?: string }) => void;
  onDDTStart?: (data: { ddt: any; taskId: string }) => void;
  onStateUpdate?: (state: ExecutionState) => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
  onWaitingForInput?: (data: { taskId: string; nodeId?: string }) => void;
}

/**
 * Executes orchestrator on backend via SSE
 * Uses BackendTypeContext to determine which backend to call (React/Ruby or VB.NET)
 */
export async function executeOrchestratorBackend(
  compilationResult: CompilationResult,
  tasks: any[],
  ddts: any[],
  translations: Record<string, string>,
  callbacks: OrchestratorCallbacks
): Promise<{ sessionId: string; stop: () => void }> {
  // Get base URL from context (React: localhost:3100, VB.NET: localhost:5000)
  // Note: This is a workaround - hooks can't be used in non-React functions
  // We'll read from localStorage directly here
  const backendType = (() => {
    try {
      const stored = localStorage.getItem('omnia_backend_type');
      return stored === 'vbnet' ? 'vbnet' : 'react';
    } catch {
      return 'react';
    }
  })();
  const baseUrl = backendType === 'vbnet' ? 'http://localhost:5000' : 'http://localhost:3100';

  console.log('🚀 [ORCHESTRATOR] Frontend calling BACKEND Orchestrator via SSE');
  console.log(`📍 [ORCHESTRATOR] Backend type: ${backendType.toUpperCase()}, Base URL: ${baseUrl}`);
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('[ORCHESTRATOR] Compilation result:', {
    tasksCount: compilationResult.tasks.length,
    entryTaskId: compilationResult.entryTaskId,
    hasTranslations: Object.keys(translations).length > 0,
    translationsCount: Object.keys(translations).length,
    timestamp: new Date().toISOString()
  });

  let sessionId: string | null = null;
  let eventSource: EventSource | null = null;

  try {
    // 1. Create backend session
    console.log('[ORCHESTRATOR] Creating backend session...');
    const startResponse = await fetch(`${baseUrl}/api/runtime/orchestrator/session/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        compilationResult: {
          ...compilationResult,
          taskMap: Object.fromEntries(compilationResult.taskMap) // Convert Map to object
        },
        tasks,
        ddts,
        translations
      })
    });

    if (!startResponse.ok) {
      const errorData = await startResponse.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`Backend orchestrator session creation failed: ${errorData.message || errorData.error || startResponse.statusText}`);
    }

    const startData = await startResponse.json();
    sessionId = startData.sessionId;
    console.log('[ORCHESTRATOR] ✅ Backend session created:', { sessionId });

    // 2. Connect to SSE stream
    console.log('[ORCHESTRATOR] Connecting to SSE stream...');
    eventSource = new EventSource(`${baseUrl}/api/runtime/orchestrator/session/${sessionId}/stream`);

    // 3. Listen to events
    eventSource.addEventListener('message', (e: MessageEvent) => {
      try {
        const msg = JSON.parse(e.data);
        console.log('[ORCHESTRATOR] SSE Event: message', msg);
        if (callbacks.onMessage) {
          callbacks.onMessage(msg);
        }
      } catch (error) {
        console.error('[ORCHESTRATOR] Error parsing message event', error);
      }
    });

    eventSource.addEventListener('ddtStart', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        console.log('[ORCHESTRATOR] SSE Event: ddtStart', data);
        if (callbacks.onDDTStart) {
          callbacks.onDDTStart(data);
        }
      } catch (error) {
        console.error('[ORCHESTRATOR] Error parsing ddtStart event', error);
      }
    });

    eventSource.addEventListener('waitingForInput', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        console.log('═══════════════════════════════════════════════════════════════════════════');
        console.log('⏳ [ORCHESTRATOR] SSE Event: waitingForInput', data);
        console.log('═══════════════════════════════════════════════════════════════════════════');
        console.log('[ORCHESTRATOR] onWaitingForInput callback exists?', !!callbacks.onWaitingForInput);
        if (callbacks.onWaitingForInput) {
          console.log('[ORCHESTRATOR] Calling onWaitingForInput callback', { hasDDT: !!data.ddt, ddtId: data.ddt?.id });
          callbacks.onWaitingForInput(data);
        } else {
          console.warn('[ORCHESTRATOR] ⚠️ onWaitingForInput callback not provided!');
        }
      } catch (error) {
        console.error('[ORCHESTRATOR] Error parsing waitingForInput event', error);
      }
    });

    eventSource.addEventListener('userInputProcessed', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        console.log('[ORCHESTRATOR] SSE Event: userInputProcessed', {
          input: data.input?.substring(0, 50),
          matchStatus: data.matchStatus,
          hasExtractedValues: !!data.extractedValues
        });
        // This will be handled by useNewFlowOrchestrator via onUserInputProcessed callback
        // We don't have a direct callback here, but the event is logged for debugging
      } catch (error) {
        console.error('[ORCHESTRATOR] Error parsing userInputProcessed event', error);
      }
    });

    eventSource.addEventListener('stateUpdate', (e: MessageEvent) => {
      try {
        const state = JSON.parse(e.data);
        console.log('[ORCHESTRATOR] SSE Event: stateUpdate', {
          currentNodeId: state.currentNodeId,
          executedCount: state.executedTaskIds?.length || 0
        });
        if (callbacks.onStateUpdate) {
          // Convert executedTaskIds array back to Set
          const executionState: ExecutionState = {
            executedTaskIds: new Set(state.executedTaskIds || []),
            variableStore: state.variableStore || {},
            retrievalState: state.retrievalState || 'empty',
            currentNodeId: state.currentNodeId || null,
            currentRowIndex: state.currentRowIndex || 0
          };
          callbacks.onStateUpdate(executionState);
        }
      } catch (error) {
        console.error('[ORCHESTRATOR] Error parsing stateUpdate event', error);
      }
    });

    eventSource.addEventListener('complete', (e: MessageEvent) => {
      try {
        const result = JSON.parse(e.data);
        console.log('═══════════════════════════════════════════════════════════════════════════');
        console.log('✅ [ORCHESTRATOR] SSE Event: complete', result);
        console.log('═══════════════════════════════════════════════════════════════════════════');
        if (callbacks.onComplete) {
          callbacks.onComplete();
        }
        if (eventSource) {
          eventSource.close();
        }
      } catch (error) {
        console.error('[ORCHESTRATOR] Error parsing complete event', error);
      }
    });

    eventSource.addEventListener('error', (e: MessageEvent) => {
      try {
        // Only parse if data exists and is valid JSON
        if (e.data && typeof e.data === 'string' && e.data.trim()) {
          const errorData = JSON.parse(e.data);
          console.error('═══════════════════════════════════════════════════════════════════════════');
          console.error('❌ [ORCHESTRATOR] SSE Event: error', errorData);
          console.error('═══════════════════════════════════════════════════════════════════════════');
          if (callbacks.onError) {
            callbacks.onError(new Error(errorData.error || 'Orchestrator execution error'));
          }
        } else {
          // SSE connection error (not a JSON error event)
          console.error('[ORCHESTRATOR] SSE connection error - event data:', e.data);
        }
        if (eventSource) {
          eventSource.close();
        }
      } catch (error) {
        console.error('[ORCHESTRATOR] Error parsing error event', error, 'Event data:', e.data);
        // Still close the connection on any error
        if (eventSource) {
          eventSource.close();
        }
        if (callbacks.onError) {
          callbacks.onError(new Error('SSE connection error'));
        }
      }
    });

    eventSource.onerror = (error) => {
      console.error('[ORCHESTRATOR] SSE connection error', {
        error,
        readyState: eventSource?.readyState,
        url: eventSource?.url,
        sessionId
      });

      // Check if connection is closed (readyState 2 = CLOSED)
      if (eventSource?.readyState === EventSource.CLOSED) {
        console.error('[ORCHESTRATOR] SSE connection closed unexpectedly');
        if (callbacks.onError) {
          callbacks.onError(new Error('SSE connection closed unexpectedly. Session may not exist on backend.'));
        }
      } else if (eventSource?.readyState === EventSource.CONNECTING) {
        // Still connecting, wait a bit
        console.warn('[ORCHESTRATOR] SSE still connecting...');
      } else {
        // Connection error
        if (callbacks.onError) {
          callbacks.onError(new Error('SSE connection error'));
        }
      }
    };

    return {
      sessionId,
      stop: () => {
        console.log('[ORCHESTRATOR] Stopping orchestrator session', { sessionId });
        if (eventSource) {
          eventSource.close();
          console.log('[ORCHESTRATOR] ✅ SSE connection closed');
        }
        if (sessionId) {
          const backendType = (() => {
            try {
              const stored = localStorage.getItem('omnia_backend_type');
              return stored === 'vbnet' ? 'vbnet' : 'react';
            } catch {
              return 'react';
            }
          })();
          const baseUrl = backendType === 'vbnet' ? 'http://localhost:5000' : 'http://localhost:3100';
          fetch(`${baseUrl}/api/runtime/orchestrator/session/${sessionId}`, {
            method: 'DELETE'
          }).catch(err => {
            console.error('[ORCHESTRATOR] Error deleting session', err);
          });
          console.log('[ORCHESTRATOR] ✅ Session deleted', { sessionId });
        }
      }
    };
  } catch (error) {
    console.error('[ORCHESTRATOR] Error in executeOrchestratorBackend', error);
    if (eventSource) {
      eventSource.close();
    }
    throw error;
  }
}

/**
 * Provides user input to backend orchestrator session
 */
export async function provideOrchestratorInput(
  sessionId: string,
  input: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get base URL from localStorage (same logic as executeOrchestratorBackend)
    const backendType = (() => {
      try {
        const stored = localStorage.getItem('omnia_backend_type');
        return stored === 'vbnet' ? 'vbnet' : 'react';
      } catch {
        return 'react';
      }
    })();
    const baseUrl = backendType === 'vbnet' ? 'http://localhost:5000' : 'http://localhost:3100';

    console.log('[ORCHESTRATOR] 📤 Providing input to backend', {
      sessionId,
      inputLength: input.length,
      backendType,
      baseUrl
    });

    const response = await fetch(
      `${baseUrl}/api/runtime/orchestrator/session/${sessionId}/input`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input })
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      return { success: false, error: errorData.error || errorData.message || 'Failed to provide input' };
    }

    const result = await response.json();
    console.log('[ORCHESTRATOR] ✅ Input successfully provided to backend');
    return { success: true };
  } catch (error) {
    console.error('[ORCHESTRATOR] Error providing input', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to provide input'
    };
  }
}

