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
  const template = useMemo<DDTTemplateV2>(() => {
    if (currentDDT) return adaptCurrentToV2(currentDDT);
    return demoTemplate;
  }, [currentDDT]);

  const { state, send, reset, setConfig } = useDDTSimulator(template, {
    typingIndicatorMs: 0,
    onLog: (e) => setLogs((l) => [...l, { ts: e.ts, kind: e.kind, message: e.message }]),
    debug: true,
  });
  const [text, setText] = useState('');
  const [crumbs, setCrumbs] = useState<string[]>([]);
  const lastModeRef = useRef<string>('');
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    if (state.mode && state.mode !== lastModeRef.current) {
      lastModeRef.current = state.mode;
      setCrumbs((c) => [...c, state.mode]);
      setLogs((l) => [...l, { ts: Date.now(), kind: 'state', message: `Mode -> ${state.mode}` }]);
    }
  }, [state.mode]);

  return (
    <div style={{ border: '1px solid #eee', padding: 12, borderRadius: 8 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <button onClick={() => reset()}>Reset</button>
        <button onClick={() => setConfig({ typingIndicatorMs: 150 })}>Typing: 150ms</button>
      </div>
      <div style={{ marginBottom: 8 }}>
        <strong>Mode:</strong> {state.mode} | <strong>Index:</strong> {state.currentIndex}
      </div>
      <div aria-label="mode-lanes" style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        {['CollectingMain','CollectingSub','ConfirmingMain','NotConfirmed','SuccessMain','Completed'].map(m => (
          <span key={m} style={{
            padding: '4px 8px',
            borderRadius: 6,
            border: '1px solid #ddd',
            background: state.mode === m ? 'rgba(59,130,246,0.12)' : 'transparent'
          }}>
            {m}
          </span>
        ))}
      </div>
      <div aria-label="breadcrumbs" style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8, color: '#555' }}>
        {crumbs.map((m, i) => (
          <span key={`${m}-${i}`}>{m}{i < crumbs.length - 1 ? ' → ' : ''}</span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          aria-label="user-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type here (e.g., 12/05/1990 or 'no' or 'choose:month')"
          style={{ flex: 1, border: '1px solid #ccc', padding: 8, borderRadius: 6 }}
        />
        <button onClick={() => { setLogs((l) => [...l, { ts: Date.now(), kind: 'input', message: text }]); void send(text); setText(''); }}>Send</button>
      </div>
      <div style={{ marginTop: 10 }}>
        <DebugGroupedPanel logs={logs} />
      </div>
    </div>
  );
}


