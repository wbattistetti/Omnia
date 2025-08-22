import React from 'react';
import { stepMeta } from './ddtUtils';
import { useDDTManager } from '../../../context/DDTManagerContext';

type ReviewItem = {
  id: string;
  stepKey: string;
  escIndex: number | null;
  actionIndex: number | null;
  textKey?: string;
  text: string;
  pathLabel: string; // tooltip only
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

export default function MessageReviewPanel({ ddt, translations }: { ddt: any; translations: Record<string, string> }) {
  const { updateTranslation } = useDDTManager();
  const items = React.useMemo(() => collectAllMessages(ddt, translations), [ddt, translations]);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState('');
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10, height: '100%', overflow: 'auto' }}>
      {items.map((it) => (
        <div key={it.id} title={it.pathLabel} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 10, display: 'flex', gap: 10, alignItems: 'flex-start', background: '#fff' }}>
          <div style={{ width: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {stepMeta[it.stepKey]?.icon || null}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            {editingId === it.id ? (
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { if (it.textKey) { try { updateTranslation(it.textKey, draft); } catch {} } setEditingId(null); } if (e.key === 'Escape') { setEditingId(null); setDraft(''); } }}
                  style={{ width: '100%', background: '#0f172a', color: '#e5e7eb', border: '1px solid #334155', borderRadius: 8, padding: '8px 10px' }}
                />
                <button onClick={() => { if (it.textKey) { try { updateTranslation(it.textKey, draft); } catch {} } setEditingId(null); }} style={{ background: '#10b981', color: 'white', border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer' }}>Save</button>
              </div>
            ) : (
              <div onClick={() => { if (it.textKey) { setEditingId(it.id); setDraft(it.text); } }} style={{ cursor: it.textKey ? 'text' : 'default' }}>{it.text}</div>
            )}
          </div>
          {typeof it.escIndex === 'number' && (
            <div style={{ fontSize: 12, color: '#64748b', minWidth: 34, textAlign: 'right' }}>#{it.escIndex + 1}</div>
          )}
        </div>
      ))}
    </div>
  );
}


