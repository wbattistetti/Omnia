import React from 'react';
import ActionList from '../ActionViewer/ActionList';
import ResponseSimulator from './ChatSimulator/ResponseSimulator';
import DDEBubbleChat from './ChatSimulator/DDEBubbleChat';

export type RightPanelMode = 'actions' | 'validator' | 'testset' | 'chat' | 'none';

type Props = {
  mode: RightPanelMode;
  width: number;
  onWidthChange: (w: number) => void;
  onStartResize: () => void;
  dragging: boolean;
  ddt: any;
  translations: Record<string, string>;
  selectedNode: any;
};

const localStorageKey = 'responseEditor.rightWidth';

export function useRightPanelWidth(initial: number = 360) {
  const [width, setWidth] = React.useState<number>(() => {
    try {
      const v = localStorage.getItem(localStorageKey);
      if (!v) return initial;
      const n = Number(v);
      return Number.isFinite(n) && n >= 120 ? n : initial;
    } catch {
      return initial;
    }
  });
  const update = (w: number) => {
    setWidth(w);
    try { localStorage.setItem(localStorageKey, String(w)); } catch {}
  };
  return { width, setWidth: update };
}

function ValidatorView({ node }: { node: any }) {
  const constraints: any[] = Array.isArray(node?.constraints) ? node.constraints : [];
  const [idx, setIdx] = React.useState<number>(0);
  const selected = constraints[idx] || null;
  const code: string = selected?.validatorTs || '';
  const hasAny = constraints.some((c) => typeof c?.validatorTs === 'string' && c.validatorTs.trim());
  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontWeight: 700 }}>Validator</span>
        <select value={idx} onChange={(e) => setIdx(Number(e.target.value))} style={{ marginLeft: 'auto' }}>
          {constraints.map((c: any, i: number) => (
            <option key={i} value={i}>{c?.title || c?.kind || `rule ${i+1}`}</option>
          ))}
        </select>
      </div>
      {!hasAny && (
        <div style={{ color: '#64748b', fontStyle: 'italic' }}>No validator available for current constraints.</div>
      )}
      {!!code && (
        <pre style={{ background: '#0b1220', color: '#e2e8f0', padding: 10, borderRadius: 8, overflow: 'auto' }}>
{code}
        </pre>
      )}
    </div>
  );
}

function TestsetView({ node }: { node: any }) {
  const constraints: any[] = Array.isArray(node?.constraints) ? node.constraints : [];
  const [idx, setIdx] = React.useState<number>(0);
  const selected = constraints[idx] || null;
  const cases: any[] = Array.isArray(selected?.testset) ? selected.testset : [];
  const hasAny = constraints.some((c) => Array.isArray(c?.testset) && c.testset.length > 0);
  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontWeight: 700 }}>Test set</span>
        <select value={idx} onChange={(e) => setIdx(Number(e.target.value))} style={{ marginLeft: 'auto' }}>
          {constraints.map((c: any, i: number) => (
            <option key={i} value={i}>{c?.title || c?.kind || `rule ${i+1}`}</option>
          ))}
        </select>
      </div>
      {!hasAny && (
        <div style={{ color: '#64748b', fontStyle: 'italic' }}>No test cases available for current constraints.</div>
      )}
      {cases.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {cases.map((tc: any, i: number) => (
            <div key={i} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 8 }}>
              <div style={{ fontWeight: 700 }}>{tc?.name || `case ${i+1}`}</div>
              <div style={{ fontSize: 12, color: '#334155' }}>input: {JSON.stringify(tc?.input)}</div>
              <div style={{ fontSize: 12, color: '#334155' }}>expect: {JSON.stringify(tc?.expect)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function RightPanel({ mode, width, onWidthChange, onStartResize, dragging, ddt, translations, selectedNode }: Props) {
  const minWidth = 160;
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    onStartResize();
  };
  const [useNewEngine, setUseNewEngine] = React.useState<boolean>(true);

  return (
    <div style={{ display: 'flex', flex: 'none', minWidth: minWidth, width, maxWidth: width, borderLeft: '1px solid #e5e7eb', background: '#fafaff' }}>
      {/* Splitter handle */}
      <div
        onMouseDown={handleMouseDown}
        style={{ width: 6, cursor: 'col-resize', background: dragging ? '#fb923c55' : 'transparent' }}
        aria-label="Resize right panel"
        role="separator"
      />
      <div style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
        {mode === 'actions' && (
          <div style={{ padding: 12 }}>
            <ActionList />
          </div>
        )}
        {mode === 'chat' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 8, borderBottom: '1px solid #e5e7eb' }}>
              <div style={{ fontWeight: 700, color: '#0b1220' }}>Chat Simulator</div>
              <button
                onClick={() => setUseNewEngine(v => !v)}
                style={{ background: '#fff', border: '1px solid #cbd5e1', color: '#0b1220', borderRadius: 6, padding: '6px 10px', cursor: 'pointer' }}
                title={useNewEngine ? 'Switch to legacy simulator' : 'Switch to new DialogueDataEngine'}
              >
                {useNewEngine ? 'Use Legacy Simulator' : 'Use new DialogueDataEngine'}
              </button>
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              {useNewEngine ? (
                <DDEBubbleChat currentDDT={ddt} translations={translations} />
              ) : (
                <ResponseSimulator ddt={ddt} translations={translations} selectedNode={selectedNode} />
              )}
            </div>
          </div>
        )}
        {mode === 'validator' && <ValidatorView node={selectedNode} />}
        {mode === 'testset' && <TestsetView node={selectedNode} />}
      </div>
    </div>
  );
}


