import React from 'react';
import TaskList from '../TaskPalette/TaskList';
// ❌ REMOVED: ResponseSimulator - contains duplicate runtime logic
// ✅ Using clean DDEBubbleChat from ResponseEditor (SSE-only, no runtime logic)
import DDEBubbleChat from './ChatSimulator/DDEBubbleChat';
import { stepMeta } from './ddtUtils';
import { useDDTManager } from '../../../context/DDTManagerContext';
import { useFontContext } from '../../../context/FontContext';

export type RightPanelMode = 'actions' | 'validator' | 'testset' | 'chat' | 'styles' | 'none';

type Props = {
  mode: RightPanelMode;
  width: number;
  onWidthChange: (w: number) => void;
  onStartResize: () => void;
  dragging: boolean;
  taskTree?: any; // ✅ Renamed from ddt to taskTree
  translations: Record<string, string>;
  selectedNode: any;
  onUpdateDDT?: (updater: (taskTree: any) => any) => void;
  hideSplitter?: boolean; // ✅ Nascondi lo splitter quando c'è un altro pannello a sinistra
  tasks?: any[]; // ✅ Tasks for escalation palette
  stepKey?: string; // ✅ Current step key for filtering tasks
};

const localStorageKey = 'responseEditor.rightWidth';
const localStorageKeyTest = 'responseEditor.testPanelWidth';

export function useRightPanelWidth(initial: number = 360, key?: string) {
  const storageKey = key || localStorageKey;
  const [width, setWidth] = React.useState<number>(() => {
    try {
      const v = localStorage.getItem(storageKey);
      if (!v) return initial;
      const n = Number(v);
      return Number.isFinite(n) && n >= 120 ? n : initial;
    } catch {
      return initial;
    }
  });
  const update = (w: number) => {
    setWidth(w);
    try { localStorage.setItem(storageKey, String(w)); } catch { }
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
            <option key={i} value={i}>{c?.title || c?.kind || `rule ${i + 1}`}</option>
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
            <option key={i} value={i}>{c?.title || c?.kind || `rule ${i + 1}`}</option>
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
              <div style={{ fontWeight: 700 }}>{tc?.name || `case ${i + 1}`}</div>
              <div style={{ color: '#334155' }}>input: {JSON.stringify(tc?.input)}</div>
              <div style={{ color: '#334155' }}>expect: {JSON.stringify(tc?.expect)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// MessageReviewView moved to MessageReview/MessageReviewView.tsx
export { default as MessageReviewView } from './MessageReview/MessageReviewView';

type Preset = { name: string; params: { style: 'formal' | 'informal' | 'neutral'; verbosity: 'concise' | 'medium' | 'verbose'; tone: 'friendly' | 'professional' | 'authoritative' | 'empathetic'; clarity: 'simple' | 'technical'; warmth: 'low' | 'medium' | 'high'; emoji: 'none' | 'light' | 'medium'; contractions: 'off' | 'on'; punctuation: 'minimal' | 'normal' | 'rich' } };
const PRESETS: Preset[] = [
  { name: 'Formal', params: { style: 'formal', verbosity: 'medium', tone: 'professional', clarity: 'simple', warmth: 'low', emoji: 'none', contractions: 'off', punctuation: 'normal' } },
  { name: 'Informal', params: { style: 'informal', verbosity: 'medium', tone: 'friendly', clarity: 'simple', warmth: 'high', emoji: 'light', contractions: 'on', punctuation: 'normal' } },
  { name: 'Concise', params: { style: 'neutral', verbosity: 'concise', tone: 'professional', clarity: 'simple', warmth: 'low', emoji: 'none', contractions: 'off', punctuation: 'minimal' } },
  { name: 'Verbose', params: { style: 'neutral', verbosity: 'verbose', tone: 'friendly', clarity: 'technical', warmth: 'medium', emoji: 'none', contractions: 'off', punctuation: 'rich' } },
  { name: 'Authoritative', params: { style: 'formal', verbosity: 'medium', tone: 'authoritative', clarity: 'simple', warmth: 'low', emoji: 'none', contractions: 'off', punctuation: 'minimal' } },
  { name: 'Empathetic', params: { style: 'informal', verbosity: 'medium', tone: 'empathetic', clarity: 'simple', warmth: 'high', emoji: 'light', contractions: 'on', punctuation: 'normal' } },
];

function StylesView() {
  const [active, setActive] = React.useState<string>('Formal');
  const preset = PRESETS.find(p => p.name === active)!;
  return (
    <div style={{ padding: 12 }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>Dialogue style</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {PRESETS.map(p => (
          <button key={p.name} onClick={() => setActive(p.name)} title={p.name} style={{ background: active === p.name ? '#0ea5e9' : 'transparent', color: active === p.name ? 'white' : '#0b1220', border: '1px solid #0ea5e9', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}>{p.name}</button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', rowGap: 6, columnGap: 12 }}>
        {Object.entries(preset.params).map(([k, v]) => (
          <React.Fragment key={k}>
            <div style={{ color: '#64748b', textTransform: 'capitalize' }}>{k}</div>
            <div>{String(v)}</div>
          </React.Fragment>
        ))}
      </div>
      <div style={{ marginTop: 12, color: '#64748b' }}>Note: presets are suggestions for wording; use Message review to edit texts. We can wire these presets to an AI rewrite later.</div>
    </div>
  );
}

export default function RightPanel({ mode, width, onWidthChange, onStartResize, dragging, taskTree, translations, selectedNode, onUpdateDDT, hideSplitter = false, tasks = [], stepKey }: Props) {
  const { combinedClass } = useFontContext();
  const minWidth = 160;
  const [isHovered, setIsHovered] = React.useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // ✅ Previene che altri splitter vengano attivati
    onStartResize();
  };
  const useNewEngine = true;

  return (
    <div className={combinedClass} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, minWidth: minWidth, width, maxWidth: width, borderLeft: hideSplitter ? 'none' : '1px solid #e5e7eb', background: '#fafaff', position: 'relative' }}>
      {/* Splitter handle sinistro - evidenziato solo su hover o quando questo specifico pannello sta ridimensionando */}
      {!hideSplitter && (
        <div
          onMouseDown={handleMouseDown}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          style={{
            width: 8,
            cursor: 'col-resize',
            background: dragging || isHovered ? '#fb923c' : '#fb923c22',
            transition: 'background 0.15s ease',
            zIndex: dragging ? 100 : 10,
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            userSelect: 'none',
            WebkitUserSelect: 'none',
            touchAction: 'none',
          }}
          aria-label="Resize right panel"
          role="separator"
        />
      )}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, minWidth: 0, overflow: 'hidden' }}>
        {mode === 'actions' && (
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: 12 }}>
            <TaskList tasks={tasks} stepKey={stepKey} />
          </div>
        )}
        {(() => {
          if (mode === 'chat') {

            return (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 8, borderBottom: '1px solid #e5e7eb' }}>
                  <div style={{ fontWeight: 700, color: '#0b1220' }}>Chat Simulator</div>
                </div>
                <div style={{ flex: 1, minHeight: 0 }}>
                  <DDEBubbleChat currentDDT={taskTree} translations={translations} onUpdateDDT={onUpdateDDT} />
                </div>
              </div>
            );
          }

          return null;
        })()}
        {mode === 'validator' && <ValidatorView node={selectedNode} />}
        {mode === 'testset' && <TestsetView node={selectedNode} />}
        {mode === 'styles' && <StylesView />}
      </div>
    </div>
  );
}


