import React from 'react';
import ActionList from '../ActionViewer/ActionList';
import ResponseSimulator from './ChatSimulator/ResponseSimulator';
import DDEBubbleChat from './ChatSimulator/DDEBubbleChat';
import { stepMeta } from './ddtUtils';
import { useDDTManager } from '../../../context/DDTManagerContext';

export type RightPanelMode = 'actions' | 'validator' | 'testset' | 'chat' | 'styles' | 'none';

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

type ReviewItem = {
  id: string;
  stepKey: string;
  escIndex: number | null;
  actionIndex: number | null;
  textKey?: string;
  text: string;
  pathLabel: string; // Main / Sub label for context
};

const STEP_ORDER = ['start', 'confirmation', 'noInput', 'noMatch', 'notConfirmed', 'notAcquired', 'success'];
const orderOf = (k: string) => {
  const i = STEP_ORDER.indexOf(k);
  return i === -1 ? 999 : i;
};

function extractActionTextKey(action: any): string | undefined {
  const params = Array.isArray(action?.parameters) ? action.parameters : [];
  const p = params.find((x: any) => x?.parameterId === 'text');
  return typeof p?.value === 'string' ? p.value : undefined;
}

function collectNodeMessages(node: any, translations: Record<string, string>, pathLabel: string): ReviewItem[] {
  const out: ReviewItem[] = [];
  const steps = node?.steps || {};
  Object.keys(steps).forEach((stepKey) => {
    const escs = Array.isArray(steps[stepKey]?.escalations) ? steps[stepKey].escalations : [];
    escs.forEach((esc: any, escIdx: number) => {
      const actions = Array.isArray(esc?.actions) ? esc.actions : [];
      actions.forEach((a: any, actIdx: number) => {
        const key = extractActionTextKey(a);
        if (typeof key === 'string') {
          out.push({
            id: `${pathLabel}|${stepKey}|${escIdx}|${actIdx}`,
            stepKey,
            escIndex: escIdx,
            actionIndex: actIdx,
            textKey: key,
            text: translations[key] || key,
            pathLabel,
          });
        }
      });
    });
  });
  // fallback legacy messages field
  const msgs = node?.messages || {};
  Object.keys(msgs).forEach((stepKey) => {
    const m = msgs[stepKey];
    const key = typeof m?.textKey === 'string' ? m.textKey : undefined;
    if (key) {
      out.push({ id: `${pathLabel}|${stepKey}|-1|-1`, stepKey, escIndex: null, actionIndex: null, textKey: key, text: translations[key] || key, pathLabel });
    }
  });
  return out;
}

function collectAllMessages(ddt: any, translations: Record<string, string>): ReviewItem[] {
  const list: ReviewItem[] = [];
  const mains: any[] = Array.isArray(ddt?.mainData) ? ddt.mainData : [];
  mains.forEach((m) => {
    const mainLabel = m?.label || 'Main';
    list.push(...collectNodeMessages(m, translations, mainLabel));
    const subs: any[] = Array.isArray(m?.subData) ? m.subData : [];
    subs.forEach((s) => {
      const subLabel = s?.label || 'Sub';
      list.push(...collectNodeMessages(s, translations, `${mainLabel} / ${subLabel}`));
    });
  });
  return list.sort((a, b) => {
    const d = orderOf(a.stepKey) - orderOf(b.stepKey);
    if (d !== 0) return d;
    const e = (a.escIndex ?? 0) - (b.escIndex ?? 0);
    if (e !== 0) return e;
    return (a.actionIndex ?? 0) - (b.actionIndex ?? 0);
  });
}

function MessageReviewView({ ddt, translations }: { ddt: any; translations: Record<string, string> }) {
  const { updateTranslation } = useDDTManager();
  const items = React.useMemo(() => collectAllMessages(ddt, translations), [ddt, translations]);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState('');
  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>Message review</div>
      {items.length === 0 && <div style={{ color: '#64748b', fontStyle: 'italic' }}>No messages found in current template.</div>}
      {items.map((it) => (
        <div key={it.id} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 8, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <div style={{ minWidth: 150, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>{stepMeta[it.stepKey]?.icon || null}</span>
            <span style={{ fontSize: 12 }}>{it.stepKey}{typeof it.escIndex === 'number' ? ` #${it.escIndex + 1}` : ''}</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>{it.pathLabel}</div>
            {editingId === it.id ? (
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { if (it.textKey) { try { updateTranslation(it.textKey, draft); } catch {} } setEditingId(null); } if (e.key === 'Escape') { setEditingId(null); setDraft(''); } }}
                  style={{ width: '100%', background: '#0f172a', color: '#e5e7eb', border: '1px solid #334155', borderRadius: 8, padding: '6px 8px' }}
                />
                <button onClick={() => { if (it.textKey) { try { updateTranslation(it.textKey, draft); } catch {} } setEditingId(null); }} style={{ background: '#10b981', color: 'white', border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer' }}>Save</button>
              </div>
            ) : (
              <div title={it.textKey ? 'Click to edit' : undefined} onClick={() => { if (it.textKey) { setEditingId(it.id); setDraft(it.text); } }} style={{ cursor: it.textKey ? 'text' : 'default' }}>{it.text}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

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
      <div style={{ marginTop: 12, color: '#64748b', fontSize: 12 }}>Note: presets are suggestions for wording; use Message review to edit texts. We can wire these presets to an AI rewrite later.</div>
    </div>
  );
}

export default function RightPanel({ mode, width, onWidthChange, onStartResize, dragging, ddt, translations, selectedNode }: Props) {
  const minWidth = 160;
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    onStartResize();
  };
  const useNewEngine = true;

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
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              <DDEBubbleChat currentDDT={ddt} translations={translations} />
            </div>
          </div>
        )}
        {mode === 'validator' && <ValidatorView node={selectedNode} />}
        {mode === 'testset' && <TestsetView node={selectedNode} />}
        {mode === 'styles' && <StylesView />}
      </div>
    </div>
  );
}


