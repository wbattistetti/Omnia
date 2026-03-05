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
 *
 * @param compilationResultJson - Original JSON from compiler (preserves all fields like taskGroups)
 * @param tasks - Tasks array
 * @param ddts - DDTs array
 * @param translations - Translations dictionary
 * @param callbacks - Event callbacks
 */
export async function executeOrchestratorBackend(
  compilationResultJson: any, // Original JSON from compiler - don't transform it!
  tasks: any[],
  ddts: any[],
  translations: Record<string, string>,
  callbacks: OrchestratorCallbacks
): Promise<{ sessionId: string; stop: () => void }> {
  // ✅ FIX: Use VB.NET backend (port 5000) instead of Ruby (3101)
  const baseUrl = 'http://localhost:5000';

  // ❌ POSTEGGIATO: Logica switch backendType - non usata per ora
  // const backendType = (() => {
  //   try {
  //     const stored = localStorage.getItem('omnia_backend_type');
  //     return stored === 'vbnet' ? 'vbnet' : 'react';
  //   } catch {
  //     return 'react';
  //   }
  // })();
  // const baseUrl = backendType === 'vbnet' ? 'http://localhost:5000' : 'http://localhost:3100';

  let sessionId: string | null = null;
  let eventSource: EventSource | null = null;

  try {
    // ✅ SINGLE POINT OF TRUTH: Ottieni projectId e locale per risoluzione traduzioni
    const rawProjectId = localStorage.getItem('currentProjectId');
    const projectId = rawProjectId || null; // ✅ Usa null invece di undefined per includerlo nel JSON
    const projectLang = localStorage.getItem('project.lang') || 'it';
    // Converti formato 'it'/'en'/'pt' in formato BCP 47 'it-IT'/'en-US'/'pt-BR'
    const localeMap: Record<string, string> = {
      'it': 'it-IT',
      'en': 'en-US',
      'pt': 'pt-BR'
    };
    const locale = localeMap[projectLang] || 'it-IT';

    // ✅ DEBUG: Log mirato per tracciare projectId
    console.log('[ORCHESTRATOR] 🔍 projectId check:', {
      rawProjectId,
      projectId,
      projectIdType: typeof projectId,
      locale,
      localStorageKey: 'currentProjectId'
    });

    // 1. Create backend session
    const requestBody = {
      compilationResult: compilationResultJson,
      tasks,
      ddts,
      translations,
      projectId, // ✅ SINGLE POINT OF TRUTH: Per risoluzione traduzioni nel backend
      locale     // ✅ SINGLE POINT OF TRUTH: Per risoluzione traduzioni nel backend
    };

    // ✅ DEBUG: Verifica che projectId sia nel JSON
    const requestBodyJson = JSON.stringify(requestBody);
    const hasProjectId = requestBodyJson.includes('"projectId"');
    console.log('[ORCHESTRATOR] 🔍 Request body check:', {
      hasProjectId,
      projectIdInJson: hasProjectId ? 'YES' : 'NO',
      requestBodyPreview: requestBodyJson.substring(0, 200)
    });

    const startResponse = await fetch(`${baseUrl}/api/runtime/orchestrator/session/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: requestBodyJson
    });

    if (!startResponse.ok) {
      // Try to get error message from response
      const responseText = await startResponse.text().catch(() => 'Unable to read response');
      console.error('[ORCHESTRATOR] ❌ Error response body:', responseText);
      try {
        const errorData = JSON.parse(responseText);
        throw new Error(`Backend orchestrator session creation failed: ${errorData.message || errorData.error || errorData.detail || startResponse.statusText}`);
      } catch (parseError) {
        throw new Error(`Backend orchestrator session creation failed: ${startResponse.statusText} - ${responseText.substring(0, 200)}`);
      }
    }

    const responseText = await startResponse.text();
    if (!responseText || responseText.trim().length === 0) {
      throw new Error('Backend orchestrator session creation returned empty response');
    }

    let startData;
    try {
      startData = JSON.parse(responseText);
    } catch (parseError) {
      const errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
      throw new Error(`Backend orchestrator session creation returned invalid JSON: ${errorMessage}`);
    }

    sessionId = startData.sessionId;
    if (!sessionId) {
      throw new Error('Backend orchestrator session creation returned invalid sessionId');
    }

    // 2. Connect to SSE stream
    const sseUrl = `${baseUrl}/api/runtime/orchestrator/session/${sessionId}/stream`;
    eventSource = new EventSource(sseUrl);
    const sse = eventSource; // Save reference for type safety in callbacks

    sse.addEventListener('open', () => {
      console.log('[ORCHESTRATOR] ✅ SSE connection opened');
    });

    sse.addEventListener('error', (e: Event) => {
      console.error('[ORCHESTRATOR] ❌ SSE connection error', e);
      console.error('[ORCHESTRATOR] 🔍 EventSource readyState on error:', sse.readyState);
      // EventSource will automatically reconnect, but log the error
    });

    sse.onerror = (error) => {
      console.error('[ORCHESTRATOR] ❌ SSE onerror', error);
      console.error('[ORCHESTRATOR] 🔍 EventSource readyState on onerror:', sse.readyState);
    };

    // 3. Listen to events
    sse.addEventListener('message', (e: MessageEvent) => {
      try {
        const msg = JSON.parse(e.data);
        if (callbacks.onMessage) {
          callbacks.onMessage(msg);
        }
      } catch (error) {
        console.error('[ORCHESTRATOR] ❌ Error parsing message event', error);
      }
    });

    sse.addEventListener('ready', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        console.log('[ORCHESTRATOR] ✅ SSE ready event:', data);
      } catch (error) {
        console.error('[ORCHESTRATOR] ❌ Error parsing ready event:', error);
      }
    });

    sse.addEventListener('ddtStart', (e: MessageEvent) => {
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

    sse.addEventListener('waitingForInput', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        console.log('═══════════════════════════════════════════════════════════════════════════');
        console.log('🔵 [ORCHESTRATOR] 🔍 BREAKPOINT: SSE Event waitingForInput received');
        console.log('🔵 [ORCHESTRATOR] 🔍 Event data:', data);
        console.log('🔵 [ORCHESTRATOR] 🔍 Raw event data:', e.data);
        console.log('═══════════════════════════════════════════════════════════════════════════');
        console.log('[ORCHESTRATOR] 🔍 onWaitingForInput callback exists?', !!callbacks.onWaitingForInput);
        if (callbacks.onWaitingForInput) {
          console.log('🔵 [ORCHESTRATOR] 🔍 About to call onWaitingForInput callback');
          console.log('🔵 [ORCHESTRATOR] 🔍 Callback data:', { hasDDT: !!data.ddt, ddtId: data.ddt?.id, taskId: data.taskId });
          callbacks.onWaitingForInput(data);
          console.log('✅ [ORCHESTRATOR] 🔍 BREAKPOINT: onWaitingForInput callback called');
        } else {
          console.warn('[ORCHESTRATOR] ⚠️ onWaitingForInput callback not provided!');
        }
      } catch (error) {
        console.error('[ORCHESTRATOR] ❌ Error parsing waitingForInput event', error);
      }
    });

    sse.addEventListener('userInputProcessed', (e: MessageEvent) => {
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

    sse.addEventListener('stateUpdate', (e: MessageEvent) => {
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

    sse.addEventListener('complete', (e: MessageEvent) => {
      try {
        const result = JSON.parse(e.data);
        if (callbacks.onComplete) {
          callbacks.onComplete();
        }
        sse.close();
      } catch (error) {
        console.error('[ORCHESTRATOR] Error parsing complete event', error);
      }
    });

    sse.addEventListener('error', (e: MessageEvent) => {
      try {
        if (e.data && typeof e.data === 'string' && e.data.trim()) {
          const errorData = JSON.parse(e.data);
          if (callbacks.onError) {
            callbacks.onError(new Error(errorData.error || 'Orchestrator execution error'));
          }
        } else {
          console.error('[ORCHESTRATOR] SSE connection error');
        }
        sse.close();
      } catch (error) {
        console.error('[ORCHESTRATOR] Error parsing error event', error, 'Event data:', e.data);
        // Still close the connection on any error
        sse.close();
        if (callbacks.onError) {
          callbacks.onError(new Error('SSE connection error'));
        }
      }
    });

    sse.onerror = (error) => {
      console.error('[ORCHESTRATOR] SSE connection error', {
        error,
        readyState: sse.readyState,
        url: sse.url,
        sessionId
      });

      // Check if connection is closed (readyState 2 = CLOSED)
      if (sse.readyState === EventSource.CLOSED) {
        console.error('[ORCHESTRATOR] SSE connection closed unexpectedly');
        if (callbacks.onError) {
          callbacks.onError(new Error('SSE connection closed unexpectedly. Session may not exist on backend.'));
        }
      } else if (sse.readyState === EventSource.CONNECTING) {
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
          // ✅ FIX: Use VB.NET backend (port 5000)
          const baseUrl = 'http://localhost:5000';
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
    // ✅ FIX: Use VB.NET backend (port 5000)
    const baseUrl = 'http://localhost:5000';

    console.log('[ORCHESTRATOR] 📤 Providing input to backend', {
      sessionId,
      inputLength: input.length,
      backendType: 'VB.NET',
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

