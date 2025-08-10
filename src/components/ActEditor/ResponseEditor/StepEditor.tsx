import React from 'react';
import { Trash2, Pencil, Check, X, MessageCircle, HelpCircle, FileText } from 'lucide-react';
import { stepMeta } from './ddtUtils';
import ActionRowDnDWrapper from './ActionRowDnDWrapper';
import ActionRow from './ActionRow';

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
  React.useEffect(() => {
    if (!node || !stepKey) return;
    try {
      const sample = (model[0]?.actions?.[0]?.textKey) || (node?.messages?.[stepKey]?.textKey) || null;
      const has = typeof sample === 'string' ? Boolean(translations[sample]) : null;
      console.log('[StepEditor] stepKey', stepKey, 'sampleKey', sample, 'hasText', has);
    } catch {}
  }, [node, stepKey, model, translations]);

  // Stato locale per le escalation e azioni (per demo, in reale va gestito a livello superiore)
  const [localModel, setLocalModel] = React.useState(model);
  React.useEffect(() => { setLocalModel(model); }, [model]);

  // Funzione per spostare una action
  const handleMoveAction = (fromEscIdx: number, fromActIdx: number, toEscIdx: number, toActIdx: number, position: 'before' | 'after') => {
    setLocalModel(prev => {
      const next = prev.map(esc => ({ ...esc, actions: [...esc.actions] }));
      const action = next[fromEscIdx].actions[fromActIdx];
      // Rimuovi dalla posizione originale
      next[fromEscIdx].actions.splice(fromActIdx, 1);
      // Calcola nuova posizione
      let insertIdx = toActIdx;
      if (fromEscIdx === toEscIdx && fromActIdx < toActIdx) insertIdx--;
      if (position === 'after') insertIdx++;
      next[toEscIdx].actions.splice(insertIdx, 0, action);
      return next;
    });
  };

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
      {/* Title removed to avoid redundancy with step tabs */}
      {/* Escalation boxes (singoli) */}
      {localModel.length === 0 && (
        <div style={{ color: '#94a3b8', fontStyle: 'italic' }}>No escalation/actions for this step.</div>
      )}
      {localModel.map((esc, idx) => (
        <div key={idx} style={{ border: `1px solid ${color}`, borderRadius: 12, marginBottom: 12, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: `${color}22`, color: color }}>
            <span style={{ fontWeight: 700 }}>{idx + 1}° recovery</span>
            {onDeleteEscalation && (
              <button onClick={() => onDeleteEscalation(idx)} title="Delete recovery" style={{ background: 'transparent', border: 'none', color: '#ef9a9a', cursor: 'pointer', lineHeight: 0 }}>
                <Trash2 size={14} />
              </button>
            )}
          </div>
          <div style={{ padding: 10 }}>
            {esc.actions.map((a, j) => (
              <ActionRowDnDWrapper
                key={j}
                escalationIdx={idx}
                actionIdx={j}
                action={a}
                onMoveAction={handleMoveAction}
              >
                <ActionRow
                  icon={actionIcon(a.actionId)}
                  text={typeof a.textKey === 'string' ? translations[a.textKey] : a.text || ''}
                  color={color}
                  draggable
                  selected={false}
                />
              </ActionRowDnDWrapper>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}


