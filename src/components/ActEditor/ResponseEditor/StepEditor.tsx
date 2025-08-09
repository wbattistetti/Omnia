import React from 'react';
import { Trash2, Pencil, Check, X, MessageCircle, HelpCircle, FileText } from 'lucide-react';
import { stepMeta } from './ddtUtils';

type Props = {
  node: any;
  stepKey: string;
  translations: Record<string, string>;
  onUpdateTranslation?: (key: string, val: string) => void;
  onDeleteEscalation?: (idx: number) => void;
  onDeleteAction?: (escIdx: number, actionIdx: number) => void;
};

type EscalationModel = { actions: Array<{ actionId: string; text?: string; textKey?: string }> };

function buildModel(node: any, stepKey: string, translations: Record<string, string>): EscalationModel[] {
  // Real step present
  if (node?.steps && node.steps[stepKey] && Array.isArray(node.steps[stepKey].escalations)) {
    const escs = node.steps[stepKey].escalations as any[];
    return escs.map((esc) => ({
      actions: (esc.actions || []).map((a: any) => {
        const p = Array.isArray(a.parameters) ? a.parameters.find((x: any) => x?.parameterId === 'text') : undefined;
        const textKey = p?.value;
        const text = typeof textKey === 'string' ? (translations[textKey] || textKey) : undefined;
        return { actionId: a.actionId, text, textKey };
      })
    }));
  }

  // Fallback synthetic step from messages
  const msg = node?.messages?.[stepKey];
  if (msg && typeof msg.textKey === 'string') {
    const textKey = msg.textKey;
    const text = translations[textKey] || textKey;
    return [
      { actions: [{ actionId: 'sayMessage', text, textKey }] }
    ];
  }
  return [];
}

export default function StepEditor({ node, stepKey, translations, onUpdateTranslation, onDeleteEscalation, onDeleteAction }: Props) {
  const meta = (stepMeta as any)[stepKey];
  const color = meta?.color || '#fb923c';
  const icon = meta?.icon || null;
  const title = meta?.label || stepKey;

  const model = React.useMemo(() => buildModel(node, stepKey, translations), [node, stepKey, translations]);

  // inline editing state for actions (by escalation index and action index)
  const [editing, setEditing] = React.useState<{ escIdx: number; actIdx: number; textKey: string; draft: string } | null>(null);

  const actionIcon = (actionId?: string) => {
    const id = (actionId || '').toLowerCase();
    if (id === 'saymessage') return <MessageCircle size={16} color={color} />;
    if (id === 'askquestion') return <HelpCircle size={16} color={color} />;
    return <FileText size={16} color={color} />;
  };

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span>{icon}</span>
        <span style={{ fontWeight: 700, color }}>{title}</span>
      </div>
      {/* Escalation boxes (singoli) */}
      {model.length === 0 && (
        <div style={{ color: '#94a3b8', fontStyle: 'italic' }}>No escalation/actions for this step.</div>
      )}
      {model.map((esc, idx) => (
          <div key={idx} style={{ border: `1px solid ${color}`, borderRadius: 12, marginBottom: 12, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: `${color}22`, color: color }}>
            <span style={{ fontWeight: 700 }}>{idx + 1}° recovery</span>
            {onDeleteEscalation && (
              <button onClick={() => onDeleteEscalation(idx)} title="Delete recovery" style={{ background: 'transparent', border: 'none', color: '#ef9a9a', cursor: 'pointer', lineHeight: 0 }}>
                <Trash2 size={14} />
              </button>
            )}
          </div>
          <div style={{ padding: 10 }}>
            {esc.actions.map((a, j) => (
                <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 2px', marginBottom: 6 }}>
                  <span>{actionIcon(a.actionId)}</span>
                  {editing && editing.escIdx === idx && editing.actIdx === j ? (
                    <>
                      <input
                        value={editing.draft}
                        onChange={(e) => setEditing({ ...editing, draft: e.target.value })}
                        style={{ flex: 1, background: '#0b1220', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 6, padding: '6px 10px' }}
                      />
                      <button title="Confirm" onClick={() => { if (onUpdateTranslation) onUpdateTranslation(editing.textKey, editing.draft); setEditing(null); }} style={{ background: 'transparent', border: 'none', color: '#22c55e', cursor: 'pointer' }}>
                        <Check size={16} />
                      </button>
                      <button title="Cancel" onClick={() => setEditing(null)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}>
                        <X size={16} />
                      </button>
                    </>
                  ) : (
                    <>
                      <span style={{ color: '#e2e8f0' }}>{(typeof a.textKey === 'string' ? translations[a.textKey] : a.text) || ''}</span>
                      {/* matita e cestino subito dopo la scritta */}
                      {typeof a.textKey === 'string' && onUpdateTranslation && (
                        <button title="Edit" onClick={() => setEditing({ escIdx: idx, actIdx: j, textKey: a.textKey!, draft: translations[a.textKey!] || '' })} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                          <Pencil size={14} />
                        </button>
                      )}
                      {onDeleteAction && (
                        <button onClick={() => onDeleteAction(idx, j)} title="Delete action" style={{ background: 'transparent', border: 'none', color: '#ef9a9a', cursor: 'pointer', lineHeight: 0 }}>
                          <Trash2 size={14} />
                        </button>
                      )}
                    </>
                  )}
                </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}


