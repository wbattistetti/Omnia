import React from 'react';
import { Trash2 } from 'lucide-react';
import { stepMeta } from './ddtUtils';
import ActionRowDnDWrapper from './ActionRowDnDWrapper';
import ActionRow from './ActionRow';
import getIconComponent from './icons';
import useActionCommands from './useActionCommands';
import { ensureHexColor } from './utils/color';
import CanvasDropWrapper from './CanvasDropWrapper';
import PanelEmptyDropZone from './PanelEmptyDropZone';

type Props = {
  node: any;
  stepKey: string;
  translations: Record<string, string>;
  onDeleteEscalation?: (idx: number) => void;
  onDeleteAction?: (escIdx: number, actionIdx: number) => void;
};

type EscalationModel = { actions: Array<{ actionId: string; text?: string; textKey?: string; icon?: string; label?: string; color?: string }> };

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

export default function StepEditor({ node, stepKey, translations, onDeleteEscalation }: Props) {
  const meta = (stepMeta as any)[stepKey];
  const color = meta?.color || '#fb923c';
  // const icon = meta?.icon || null;
  // const title = meta?.label || stepKey;

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

  const { editAction, deleteAction, moveAction, dropFromViewer, appendAction } = useActionCommands(setLocalModel);

  const getText = (a: any) => (typeof a.textKey === 'string' ? translations[a.textKey] : a.text || '');

  const handleQuickAdd = () => {
    // Azione base: sayMessage vuota
    appendAction(0, { actionId: 'sayMessage', text: '' } as any);
  };

  return (
    <div style={{ padding: 16 }}>
      {/* Title removed to avoid redundancy with step tabs */}
      {/* Escalation boxes (singoli) */}
      {localModel.length === 0 && (
        <div style={{ color: '#94a3b8', fontStyle: 'italic' }}>No escalation/actions for this step.</div>
      )}
      {['start', 'success'].includes(stepKey) ? (
        // Per start/success: canvas droppabile per append; i row wrapper non accettano drop dal viewer
        <CanvasDropWrapper onDropAction={(action) => appendAction(0, action)} color={color}>
          {localModel[0]?.actions?.map((a, j) => (
            <ActionRowDnDWrapper
              key={j}
              escalationIdx={0}
              actionIdx={j}
              action={a}
              onMoveAction={moveAction}
              onDropNewAction={(action, to, pos) => dropFromViewer(action, to, pos)}
              allowViewerDrop={true}
            >
              <ActionRow
                icon={getIconComponent(a.icon || a.actionId, ensureHexColor(a.color))}
                text={getText(a)}
                color={color}
                draggable
                selected={false}
                actionId={a.actionId}
                label={a.label || a.actionId}
                onEdit={(newText) => editAction(0, j, newText)}
                onDelete={() => deleteAction(0, j)}
              />
            </ActionRowDnDWrapper>
          ))}
        </CanvasDropWrapper>
      ) : (
        localModel.map((esc, idx) => (
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
              {esc.actions.length === 0 ? (
                <PanelEmptyDropZone color={color} onDropAction={(action) => appendAction(idx, action)} />
              ) : (
                esc.actions.map((a, j) => (
                  <ActionRowDnDWrapper
                    key={j}
                    escalationIdx={idx}
                    actionIdx={j}
                    action={a}
                    onMoveAction={moveAction}
                    onDropNewAction={(action, to, pos) => dropFromViewer(action, to, pos)}
                    allowViewerDrop={true}
                  >
                    <ActionRow
                      icon={getIconComponent(a.icon || a.actionId, ensureHexColor(a.color))}
                      text={getText(a)}
                      color={color}
                      draggable
                      selected={false}
                      actionId={a.actionId}
                      label={a.label || a.actionId}
                      onEdit={(newText) => editAction(idx, j, newText)}
                      onDelete={() => deleteAction(idx, j)}
                    />
                  </ActionRowDnDWrapper>
                ))
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}


