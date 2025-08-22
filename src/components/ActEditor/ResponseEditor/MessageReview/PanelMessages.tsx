import React from 'react';
import { stepMeta } from '../ddtUtils';
import { PlayCircle, HelpCircle, MicOff, CheckCircle2, CheckSquare, AlertCircle, Check, X as XIcon } from 'lucide-react';
import { useDDTManager } from '../../../../context/DDTManagerContext';
import { collectAllMessages, ReviewItem } from './messageUtils';

type Props = {
  ddt: any;
  translations: Record<string, string>;
  width?: number;
  styleChips?: Array<{ key: string; value: string }>;
  multiColumn?: boolean;
};

export default function PanelMessages({ ddt, translations, width = 520, styleChips = [], multiColumn = false }: Props) {
  const { updateTranslation } = useDDTManager();
  const dbg = (...args: any[]) => { try { if (localStorage.getItem('debug.messageReview') === '1') console.log('[MessageReview][Panel]', ...args); } catch {} };
  const items = React.useMemo(() => collectAllMessages(ddt, translations), [ddt, translations]);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState('');
  React.useEffect(() => { try { localStorage.setItem('debug.messageReview', '1'); } catch {} }, []);
  React.useEffect(() => {
    try {
      if (localStorage.getItem('debug.messageReview') === '1') {
        const sample = items.slice(0, 10).map(it => ({ stepKey: it.stepKey, escIndex: it.escIndex, path: it.pathLabel }));
        console.log('[MessageReview][mount] sample items', sample);
      }
    } catch {}
  }, [items]);
  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* messages list */}
      <div
        style={
          multiColumn
            ? { padding: 12, overflow: 'auto', flex: 1, columnWidth: 360, columnGap: 12 }
            : { padding: 12, overflow: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }
        }
      >
        {(() => {
          // Compute alternating group index based on pathLabel (Main / Sub)
          let currentLabel: string | null = null;
          let group = 0;
          const withGroup = items.map((it) => {
            if (it.pathLabel !== currentLabel) { currentLabel = it.pathLabel; group += 1; }
            return { it, group };
          });
          return withGroup.map(({ it, group }) => {
          const meta = (stepMeta as any)[it.stepKey];
          const Icon = (
            it.stepKey === 'start' ? PlayCircle :
            it.stepKey === 'noMatch' ? HelpCircle :
            it.stepKey === 'noInput' ? MicOff :
            it.stepKey === 'confirmation' ? CheckCircle2 :
            it.stepKey === 'success' ? CheckSquare :
            it.stepKey === 'notAcquired' ? AlertCircle :
            it.stepKey === 'notConfirmed' ? AlertCircle : undefined
          ) as any;
          const iconName = (
            it.stepKey === 'start' ? 'PlayCircle' :
            it.stepKey === 'noMatch' ? 'HelpCircle' :
            it.stepKey === 'noInput' ? 'MicOff' :
            it.stepKey === 'confirmation' ? 'CheckCircle2' :
            it.stepKey === 'success' ? 'CheckSquare' :
            it.stepKey === 'notAcquired' ? 'AlertCircle' :
            it.stepKey === 'notConfirmed' ? 'AlertCircle' : 'unknown'
          );
          dbg('render.item', { stepKey: it.stepKey, escIndex: it.escIndex, iconName, color: meta?.color });
          const groupBg = (group % 2 === 1) ? 'rgba(148,163,184,0.3)' : 'transparent';
          return (
          <div key={it.id} title={it.pathLabel} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 10, display: 'flex', gap: 10, alignItems: 'flex-start', background: groupBg, breakInside: 'avoid-column', marginBottom: 10, width: '100%', display: 'inline-flex' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 64, color: meta?.color }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                {Icon ? <Icon size={17} color={meta?.color} /> : null}
              </span>
              {typeof it.escIndex === 'number' && (
                <span style={{ fontSize: 11, color: meta?.color, border: `1px solid ${meta?.color || '#94a3b8'}`, borderRadius: 8, padding: '0 6px' }}>#{it.escIndex + 1}</span>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              {editingId === it.id ? (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { if (it.textKey) { try { updateTranslation(it.textKey, draft); } catch {} } setEditingId(null); } if (e.key === 'Escape') { setEditingId(null); setDraft(''); } }}
                    style={{ width: '100%', background: '#0f172a', color: '#e5e7eb', border: '1px solid #334155', borderRadius: 8, padding: '8px 10px' }}
                  />
                  <button title="Save" onClick={() => { if (it.textKey) { try { updateTranslation(it.textKey, draft); } catch {} } setEditingId(null); }} style={{ background: 'transparent', border: '1px solid #10b981', color: '#10b981', borderRadius: 8, padding: 6, lineHeight: 0, cursor: 'pointer' }}>
                    <Check size={16} />
                  </button>
                  <button title="Cancel" onClick={() => { setEditingId(null); setDraft(''); }} style={{ background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', borderRadius: 8, padding: 6, lineHeight: 0, cursor: 'pointer' }}>
                    <XIcon size={16} />
                  </button>
                </div>
              ) : (
                <div onClick={() => { if (it.textKey) { setEditingId(it.id); setDraft(it.text); } }} style={{ cursor: it.textKey ? 'text' : 'default' }}>{it.text}</div>
              )}
            </div>
          </div>
          );
          });
        })()}
      </div>
      {/* chips moved to header toolbar in MessageReview */}
    </div>
  );
}


