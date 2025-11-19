import React, { useEffect, useMemo, useRef, useState } from 'react';
import DebugGroupedPanel, { type LogEntry } from './DebugGroupedPanel';
import type { AssembledDDT } from '../DialogueDataTemplateBuilder/DDTAssembler/currentDDT.types';
import { adaptCurrentToV2 } from '../DialogueDataEngine/model/adapters/currentToV2';
import type { DDTTemplateV2 } from '../DialogueDataEngine/model/ddt.v2.types';
import { useDDTSimulator } from '../DialogueDataEngine/useSimulator';

type Props = { currentDDT?: AssembledDDT };

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

  const { state, send, reset, setConfig } = useDDTSimulator(template, {
    typingIndicatorMs: 0,
    onLog: (e) => setLogs((l) => [...l, { ts: e.ts, kind: e.kind, message: e.message }]),
    debug: false,
  });
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

  // Seed first main ask if empty
  useEffect(() => {
    if (messages.length > 0) return;
    try {
      const firstMain = (template.nodes || []).find((n: any) => n?.type === 'main');
      const ask = resolveTxt(firstMain?.steps?.ask?.base);
      if (ask) setMessages([{ from: 'bot', text: ask }]);
    } catch {}
  }, [template, messages.length]);

  // Append prompts based on engine transitions
  const prevIndexRef = useRef<number>(-1);
  const lastPromptKeyRef = useRef<string>('');
  useEffect(() => {
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
  }, [state, planById]);

  return (
    <div style={{ border: '1px solid var(--sidebar-border, #334155)', padding: 8, borderRadius: 8 }}>
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
          placeholder="Scrivi qui..."
          style={{ flex: 1, border: '1px solid #334155', padding: 8, borderRadius: 6, background: 'transparent', color: 'var(--sidebar-content-text, #f1f5f9)' }}
        />
        <button onClick={() => { if (!text.trim()) return; setMessages(m => [...m, { from: 'user', text }]); setLogs((l) => [...l, { ts: Date.now(), kind: 'input', message: text }]); void send(text); setText(''); }} style={{ border: '1px solid #334155', borderRadius: 6, padding: '6px 10px' }}>Invia</button>
      </div>
      {/* Optional debug log panel */}
      {logs.length > 0 && (
      <div style={{ marginTop: 10 }}>
        <DebugGroupedPanel logs={logs} />
      </div>
      )}
    </div>
  );
}


