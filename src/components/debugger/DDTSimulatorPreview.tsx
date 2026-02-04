import React, { useEffect, useMemo, useRef, useState } from 'react';
import DebugGroupedPanel, { type LogEntry } from './DebugGroupedPanel';
import type { AssembledTaskTree } from '../TaskTreeBuilder/DDTAssembler/currentDDT.types';
import { adaptCurrentToV2 } from '../DialogueDataEngine/model/adapters/currentToV2';
import type { DDTTemplateV2 } from '../DialogueDataEngine/model/ddt.v2.types';
import { useDDTSimulator } from '../DialogueDataEngine/useSimulator';

type Props = { currentDDT?: AssembledTaskTree };

// ⭐ Backend DDT sempre attivo - Ruby è l'unica fonte di verità
// Rimossa funzione getUseBackendDDTEngine() - backend sempre attivo

const demoTemplate: DDTTemplateV2 = {
  schemaVersion: '2',
  metadata: { id: 'DDT_Demo', label: 'Demo Date' },
  nodes: [
    {
      id: 'date',
      label: 'Date',
      type: 'main',
      required: true,
      kind: 'date',
      steps: {
        ask: { base: 'ask', reaskNoInput: ['', '', ''], reaskNoMatch: ['', '', ''] },
        confirm: { base: 'confirm', noInput: ['', '', ''], noMatch: ['', '', ''] },
        success: { base: ['saved'] },
      },
      subs: ['day', 'month', 'year'],
    },
    { id: 'day', label: 'Day', type: 'sub', kind: 'generic', steps: { ask: { base: 'x', reaskNoInput: ['', '', ''], reaskNoMatch: ['', '', ''] } } } as any,
    { id: 'month', label: 'Month', type: 'sub', kind: 'generic', steps: { ask: { base: 'x', reaskNoInput: ['', '', ''], reaskNoMatch: ['', '', ''] } } } as any,
    { id: 'year', label: 'Year', type: 'sub', kind: 'generic', steps: { ask: { base: 'x', reaskNoInput: ['', '', ''], reaskNoMatch: ['', '', ''] } } } as any,
  ],
};

export default function DDTSimulatorPreview({ currentDDT }: Props) {
  const [template, setTemplate] = useState<DDTTemplateV2>(demoTemplate);
  // ⭐ Backend DDT sempre attivo - Ruby è l'unica fonte di verità
  const useBackend = true;
  const [backendError, setBackendError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const pendingInputResolveRef = useRef<((value: any) => void) | null>(null);

  // ⭐ Rimossa logica di monitoraggio flag - backend sempre attivo

  useEffect(() => {
    if (currentDDT) {
      // ✅ projectLanguage è OBBLIGATORIO - nessun fallback
      let projectLanguage: string;
      try {
        const lang = localStorage.getItem('project.lang');
        if (!lang) {
          throw new Error('[DDTSimulatorPreview] project.lang not found in localStorage. Cannot adapt DDT without project language.');
        }
        projectLanguage = lang;
      } catch (err) {
        console.error('[DDTSimulatorPreview] Failed to get project language:', err);
        setTemplate(demoTemplate);
        return;
      }

      adaptCurrentToV2(currentDDT, projectLanguage)
        .then((result) => {
          setTemplate(result);
        })
        .catch((err) => {
          console.error('[DDTSimulatorPreview] Error adapting DDT to V2', err);
          setTemplate(demoTemplate);
        });
    } else {
      setTemplate(demoTemplate);
    }
  }, [currentDDT]);

  // ⭐ Backend DDT Engine logic
  useEffect(() => {
    if (!useBackend || !currentDDT) return;

    const baseUrl = 'http://localhost:3101';

    // Start backend session
    const startSession = async () => {
      try {
        setBackendError(null);
        const translations = ((currentDDT as any)?.translations && (((currentDDT as any).translations as any).en || (currentDDT as any).translations)) || {};

        const startResponse = await fetch(`${baseUrl}/api/runtime/ddt/session/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ddtInstance: currentDDT,
            translations,
            limits: {
              noMatchMax: 3,
              noInputMax: 3,
              notConfirmedMax: 2
            }
          })
        });

        if (!startResponse.ok) {
          const errorText = await startResponse.text();
          throw new Error(`Backend server not available: ${startResponse.statusText} - ${errorText}`);
        }

        const { sessionId: newSessionId } = await startResponse.json();
        setSessionId(newSessionId);
        console.log('[DDTSimulatorPreview] ✅ Backend session created:', { sessionId: newSessionId });

        // Open SSE stream
        const eventSource = new EventSource(`${baseUrl}/api/runtime/ddt/session/${newSessionId}/stream`);
        eventSourceRef.current = eventSource;

        // Handle messages from backend
        eventSource.addEventListener('message', (e: MessageEvent) => {
          try {
            const msg = JSON.parse(e.data);
            console.log('[DDTSimulatorPreview] Backend message:', msg);
            setMessages((m) => [...m, { from: 'bot', text: msg.text || '' }]);
          } catch (error) {
            console.error('[DDTSimulatorPreview] Error parsing message', error);
          }
        });

        // Handle waiting for input
        eventSource.addEventListener('waitingForInput', async (e: MessageEvent) => {
          try {
            const { nodeId } = JSON.parse(e.data);
            console.log('[DDTSimulatorPreview] Backend waiting for input:', { nodeId });
            // Input will be provided when user types and clicks "Invia"
          } catch (error) {
            console.error('[DDTSimulatorPreview] Error parsing waitingForInput', error);
          }
        });

        // Handle completion
        eventSource.addEventListener('complete', (e: MessageEvent) => {
          try {
            const result = JSON.parse(e.data);
            console.log('[DDTSimulatorPreview] Backend complete:', result);
            if (result.success) {
              setMessages((m) => [...m, { from: 'bot', text: '✅ Dati raccolti con successo!' }]);
            }
          } catch (error) {
            console.error('[DDTSimulatorPreview] Error parsing complete', error);
          }
        });

        // Handle errors
        eventSource.addEventListener('error', (e: MessageEvent) => {
          try {
            if (e.data) {
              const errorData = JSON.parse(e.data);
              setBackendError(errorData.error || 'Backend error');
            }
          } catch (error) {
            console.error('[DDTSimulatorPreview] Error parsing error event', error);
          }
        });

        eventSource.onerror = (error) => {
          console.error('[DDTSimulatorPreview] SSE connection error', error);
          if (eventSource.readyState === EventSource.CLOSED) {
            setBackendError('Connection to backend server closed. Is Ruby server running on port 3101?');
          }
        };
      } catch (error) {
        console.error('[DDTSimulatorPreview] Backend session error', error);
        setBackendError(error instanceof Error ? error.message : 'Failed to connect to backend server. Is Ruby server running on port 3101?');
      }
    };

    startSession();

    // Cleanup on unmount or when switching away from backend
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (sessionId) {
        const baseUrl = 'http://localhost:3101';
        fetch(`${baseUrl}/api/runtime/ddt/session/${sessionId}`, {
          method: 'DELETE'
        }).catch(() => {});
      }
    };
  }, [useBackend, currentDDT, sessionId]);

  // ⭐ Frontend engine (only if backend is not enabled)
  const frontendEngine = useDDTSimulator(template, {
    typingIndicatorMs: 0,
    onLog: (e) => setLogs((l) => [...l, { ts: e.ts, kind: e.kind, message: e.message }]),
    debug: false,
  });

  const { state, send, reset, setConfig } = useBackend ? {
    state: null,
    send: async () => {},
    reset: () => {},
    setConfig: () => {}
  } : frontendEngine;
  const [text, setText] = useState('');
  const lastModeRef = useRef<string>('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [messages, setMessages] = useState<Array<{ from: 'bot' | 'user'; text: string }>>([]);

  const translations = useMemo(() => ((currentDDT as any)?.translations && (((currentDDT as any).translations as any).en || (currentDDT as any).translations)) || {}, [currentDDT]);
  const planById = useMemo<Record<string, any>>(() => {
    const map: Record<string, any> = {};
    try {
      const nodes = (template.nodes || []) as any[];
      for (const n of nodes) map[n.id] = n;
    } catch {}
    return map;
  }, [template]);

  const resolveTxt = (key?: string): string => {
    if (!key) return '';
    if (/\s/.test(key) && !/^[\w.-]+\.[\w.-]+/.test(key)) return key; // already plain text
    const t = (translations as any)[key];
    return typeof t === 'string' && t.trim() ? t : key;
  };

  // ❌ REMOVED: Seed first main ask - backend determines initial message via SSE
  // No frontend logic should determine which message to show
  // All messages come from backend via SSE stream

  // Append prompts based on engine transitions (only for frontend engine)
  const prevIndexRef = useRef<number>(-1);
  const lastPromptKeyRef = useRef<string>('');
  useEffect(() => {
    if (useBackend || !state) return;

    // Track mode changes (no breadcrumbs UI)
    if (state.mode && state.mode !== lastModeRef.current) {
      lastModeRef.current = state.mode;
    }
    const plan = state.plan;
    const currentMainId = plan?.order?.[state.currentIndex];
    // On main index change → ask next main
    if (state.currentIndex !== prevIndexRef.current && currentMainId) {
      prevIndexRef.current = state.currentIndex;
      const mainAsk = resolveTxt(planById[currentMainId]?.steps?.ask?.base);
      if (mainAsk) {
        const key = `main:${currentMainId}:ask`;
        if (lastPromptKeyRef.current !== key) {
          setMessages((m) => [...m, { from: 'bot', text: mainAsk }]);
          lastPromptKeyRef.current = key;
        }
      }
    }
    // When entering CollectingSub → ask sub
    if (state.mode === 'CollectingSub' && state.currentSubId) {
      const subAsk = resolveTxt(planById[state.currentSubId]?.steps?.ask?.base);
      if (subAsk) {
        const key = `sub:${state.currentSubId}:ask`;
        if (lastPromptKeyRef.current !== key) {
          setMessages((m) => [...m, { from: 'bot', text: subAsk }]);
          lastPromptKeyRef.current = key;
        }
      }
    }
    // Confirming main
    if (state.mode === 'ConfirmingMain' && currentMainId) {
      const confirm = resolveTxt(planById[currentMainId]?.steps?.confirm?.base);
      if (confirm) {
        const key = `main:${currentMainId}:confirm`;
        if (lastPromptKeyRef.current !== key) {
          setMessages((m) => [...m, { from: 'bot', text: confirm }]);
          lastPromptKeyRef.current = key;
        }
      }
    }
    // Success main → show success first message
    if (state.mode === 'SuccessMain' && currentMainId) {
      const successArr = planById[currentMainId]?.steps?.success?.base || [];
      const success = Array.isArray(successArr) ? successArr[0] : undefined;
      const msg = resolveTxt(success);
      if (msg) {
        const key = `main:${currentMainId}:success`;
        if (lastPromptKeyRef.current !== key) {
          setMessages((m) => [...m, { from: 'bot', text: msg }]);
          lastPromptKeyRef.current = key;
        }
      }
    }
  }, [state, planById, useBackend]);

  // ⭐ Handle input for backend
  const handleBackendInput = async (inputText: string) => {
    if (!sessionId || !useBackend) return;

    const baseUrl = 'http://localhost:3101';
    try {
      const response = await fetch(`${baseUrl}/api/runtime/ddt/session/${sessionId}/input`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: inputText })
      });

      if (!response.ok) {
        const errorText = await response.text();
        setBackendError(`Failed to send input: ${errorText}`);
      }
    } catch (error) {
      console.error('[DDTSimulatorPreview] Error sending input to backend', error);
      setBackendError(error instanceof Error ? error.message : 'Failed to send input to backend');
    }
  };

  // ⭐ Handle input (backend or frontend)
  const handleSend = () => {
    if (!text.trim()) return;

    setMessages((m) => [...m, { from: 'user', text }]);
    setLogs((l) => [...l, { ts: Date.now(), kind: 'input', message: text }]);

    if (useBackend) {
      handleBackendInput(text);
    } else {
      send(text);
    }

    setText('');
  };

  return (
    <div style={{ border: '1px solid var(--sidebar-border, #334155)', padding: 8, borderRadius: 8 }}>
      {/* Backend error message */}
      {useBackend && backendError && (
        <div style={{
          marginBottom: 8,
          padding: 8,
          background: '#fee2e2',
          border: '1px solid #fca5a5',
          borderRadius: 4,
          color: '#991b1b',
          fontSize: '12px'
        }}>
          ⚠️ {backendError}
          <div style={{ marginTop: 4, fontSize: '11px', color: '#7f1d1d' }}>
            Assicurati che il server Ruby sia avviato: <code>cd backend/ruby && bundle exec rackup config.ru</code>
          </div>
        </div>
      )}

      {/* Backend status */}
      {useBackend && !backendError && (
        <div style={{
          marginBottom: 8,
          padding: 4,
          background: '#dcfce7',
          border: '1px solid #86efac',
          borderRadius: 4,
          color: '#166534',
          fontSize: '11px'
        }}>
          ✅ Connesso al backend Ruby (porta 3101)
        </div>
      )}

      {/* Transcript */}
      <div style={{ maxHeight: 180, overflowY: 'auto', marginBottom: 8 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: 6, color: m.from === 'bot' ? '#e5e7eb' : '#93c5fd' }}>{m.text}</div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          aria-label="user-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={useBackend ? "Type response... (Backend DDT)" : "Scrivi qui..."}
          style={{ flex: 1, border: '1px solid #334155', padding: 8, borderRadius: 6, background: 'transparent', color: 'var(--sidebar-content-text, #f1f5f9)' }}
          disabled={useBackend && !sessionId}
        />
        <button
          onClick={handleSend}
          disabled={useBackend && !sessionId}
          style={{
            border: '1px solid #334155',
            borderRadius: 6,
            padding: '6px 10px',
            opacity: (useBackend && !sessionId) ? 0.5 : 1,
            cursor: (useBackend && !sessionId) ? 'not-allowed' : 'pointer'
          }}
        >
          Invia
        </button>
      </div>
      {/* Optional debug log panel */}
      {!useBackend && logs.length > 0 && (
      <div style={{ marginTop: 10 }}>
        <DebugGroupedPanel logs={logs} />
      </div>
      )}
    </div>
  );
}


