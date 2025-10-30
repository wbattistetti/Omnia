import React from 'react';
import { Trash2 } from 'lucide-react';
import { stepMeta } from './ddtUtils';
import ActionRowDnDWrapper from './ActionRowDnDWrapper';
import ActionRow from './ActionRow';
import { getActionIconNode, getActionLabel } from './actionMeta';
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
  onModelChange?: (next: EscalationModel[]) => void;
};

type EscalationModel = { actions: Array<{ actionId: string; text?: string; textKey?: string; icon?: string; label?: string; color?: string }> };

function buildModel(node: any, stepKey: string, translations: Record<string, string>): EscalationModel[] {
  // Always log to diagnose message display issues
  const shape = Array.isArray(node?.steps) ? 'array' : (node?.steps ? 'object' : 'none');
  const keys = node?.steps && !Array.isArray(node.steps) ? Object.keys(node.steps) : (Array.isArray(node?.steps) ? (node.steps as any[]).map((g: any) => g?.type) : []);
  console.log('[RE][buildModel] START', {
    nodeLabel: node?.label,
    stepKey,
    stepsShape: shape,
    stepsKeys: keys,
    hasMessages: !!node?.messages,
    messagesKeys: Object.keys(node?.messages || {}),
    messagesForStep: node?.messages?.[stepKey]
  });
  // Case A: steps as object { start: { escalations: [...] } }
  if (node?.steps && !Array.isArray(node.steps) && node.steps[stepKey] && Array.isArray(node.steps[stepKey].escalations)) {
    const escs = node.steps[stepKey].escalations as any[];
    console.log('[RE][buildModel] Using Case A (object steps)', { stepKey, escalationsCount: escs.length });
    return escs.map((esc) => ({
      actions: (esc.actions || []).map((a: any) => {
        const p = Array.isArray(a.parameters) ? a.parameters.find((x: any) => x?.parameterId === 'text') : undefined;
        const textKey = p?.value;
        const text = (typeof a.text === 'string' && a.text.length > 0)
          ? a.text
          : (typeof textKey === 'string' ? (translations[textKey] || textKey) : undefined);
        return { actionId: a.actionId, text, textKey };
      })
    }));
  }

  // Case B: steps as array [{ type: 'start', escalations: [...] }, ...]
  if (Array.isArray(node?.steps)) {
    const group = (node.steps as any[]).find((g: any) => (g?.type === stepKey));
    if (group && Array.isArray(group.escalations)) {
      console.log('[RE][buildModel] Using Case B (array steps)', { stepKey, escalationsCount: group.escalations.length });
      return (group.escalations as any[]).map((esc: any) => ({
        actions: (esc.actions || []).map((a: any) => {
          const p = Array.isArray(a.parameters) ? a.parameters.find((x: any) => x?.parameterId === 'text') : undefined;
          const textKey = p?.value;
          const text = (typeof a.text === 'string' && a.text.length > 0)
            ? a.text
            : (typeof textKey === 'string' ? (translations[textKey] || textKey) : undefined);
          return { actionId: a.actionId, text, textKey };
        })
      }));
    } else {
      console.log('[RE][buildModel] Case B: No group found for stepKey', { stepKey, availableTypes: node.steps.map((g: any) => g?.type) });
    }
  }

  // Fallback synthetic step from messages
  const msg = node?.messages?.[stepKey];
  if (msg && typeof msg.textKey === 'string') {
    const textKey = msg.textKey;
    const text = translations[textKey] || textKey;
    console.log('[RE][buildModel] Using messages fallback', { stepKey, textKey, hasText: !!text });
    return [
      { actions: [{ actionId: 'sayMessage', text, textKey }] }
    ];
  }
  // Last‑resort: derive from translation keys (runtime.*) containing node label and stepKey
  try {
    const label = String(node?.label || '').trim();
    const keys = Object.keys(translations || {});
    const matches = keys.filter(k => (stepKey ? k.includes(`.${stepKey}.`) : false) && (label ? k.includes(label) : true));
    if (matches.length > 0) {
      console.log('[RE][buildModel] Using translation keys fallback', { stepKey, matchesCount: matches.length });
      return [
        {
          actions: matches.map(k => ({ actionId: 'sayMessage', text: translations[k] || k, textKey: k }))
        }
      ];
    }
  } catch { }
  console.log('[RE][buildModel] NO DATA - returning empty model', { stepKey });
  return [];
}

export default function StepEditor({ node, stepKey, translations, onDeleteEscalation, onModelChange }: Props) {
  // No special-case: notConfirmed behaves like other steps (escalations UI)
  const meta = (stepMeta as any)[stepKey];
  const color = meta?.color || '#fb923c';
  // const icon = meta?.icon || null;
  // const title = meta?.label || stepKey;

  const model = React.useMemo(() => {
    const result = buildModel(node, stepKey, translations);
    console.log('[StepEditor] Building model', {
      nodeLabel: node?.label,
      stepKey,
      modelLength: result.length,
      hasSteps: !!node?.steps,
      stepsShape: Array.isArray(node?.steps) ? 'array' : (node?.steps ? 'object' : 'none'),
      hasMessages: !!node?.messages,
      messageForStep: node?.messages?.[stepKey]
    });
    return result;
  }, [node, stepKey, translations]);
  // Debug logging gated; enable via localStorage.setItem('debug.stepEditor','1')
  React.useEffect(() => {
    if (!node || !stepKey) return;
    try {
      if (localStorage.getItem('debug.stepEditor') !== '1') return;
      const sample = (model[0]?.actions?.[0]?.textKey) || (node?.messages?.[stepKey]?.textKey) || null;
      const has = typeof sample === 'string' ? Boolean(translations[sample]) : null;
      console.log('[StepEditor] stepKey', stepKey, 'sampleKey', sample, 'hasText', has);
    } catch { }
  }, [node, stepKey, model, translations]);

  // Stato locale per le escalation e azioni (per demo, in reale va gestito a livello superiore)
  const [localModel, setLocalModel] = React.useState(model);
  React.useEffect(() => { setLocalModel(model); }, [model]);

  // Commit esplicito: chiamato solo da useActionCommands dopo ogni azione (drop, append, edit, delete, move)
  const commitUp = React.useCallback((next: EscalationModel[]) => {
    console.log('[StepEditor][commitUp] Notifying parent of change', { stepKey, escalationsCount: next.length });
    try { onModelChange?.(next); } catch { }
  }, [onModelChange, stepKey]);
  const { editAction, deleteAction, moveAction, dropFromViewer, appendAction } = useActionCommands(setLocalModel as any, commitUp as any);

  // Priorità: a.text (UI-local) > translations[a.textKey] (persisted)
  const getText = (a: any) => (a.text || (typeof a.textKey === 'string' ? translations[a.textKey] : '') || '');

  // const handleQuickAdd = () => {
  //   // Azione base: sayMessage vuota
  //   appendAction(0, { actionId: 'sayMessage', text: '' } as any);
  // };

  // Auto-focus editing after drop/append
  const [autoEditTarget, setAutoEditTarget] = React.useState<{ escIdx: number; actIdx: number } | null>(null);

  const handleAppend = React.useCallback((escIdx: number, action: any) => {
    const currentLen = (localModel?.[escIdx]?.actions?.length) || 0;
    appendAction(escIdx, action);
    setAutoEditTarget({ escIdx, actIdx: currentLen });
  }, [appendAction, localModel]);

  const handleDropFromViewer = React.useCallback((incoming: any, to: { escalationIdx: number; actionIdx: number }, position: 'before' | 'after') => {
    const targetIdx = position === 'after' ? to.actionIdx + 1 : to.actionIdx;
    dropFromViewer(incoming, to, position);
    setAutoEditTarget({ escIdx: to.escalationIdx, actIdx: targetIdx });
  }, [dropFromViewer]);

  return (
    <div style={{ padding: 16 }}>
      {/* Title removed to avoid redundancy with step tabs */}
      {/* Escalation boxes (singoli) */}
      {localModel.length === 0 && (
        <div style={{ color: '#94a3b8', fontStyle: 'italic' }}>No escalation/actions for this step.</div>
      )}
      {['start', 'success'].includes(stepKey) ? (
        // Per start/success: canvas droppabile per append; i row wrapper non accettano drop dal viewer
        <CanvasDropWrapper onDropAction={(action) => handleAppend(0, action)} color={color}>
          {localModel[0]?.actions?.map((a, j) => (
            <ActionRowDnDWrapper
              key={j}
              escalationIdx={0}
              actionIdx={j}
              action={a}
              onMoveAction={moveAction}
              onDropNewAction={(action, to, pos) => handleDropFromViewer(action, to, pos)}
              allowViewerDrop={true}
            >
              <ActionRow
                icon={getActionIconNode(a.actionId, ensureHexColor(a.color))}
                text={getText(a)}
                color={color}
                draggable
                selected={false}
                actionId={a.actionId}
                label={getActionLabel(a.actionId)}
                onEdit={a.actionId === 'sayMessage' ? (newText) => editAction(0, j, newText) : undefined}
                onDelete={() => deleteAction(0, j)}
                autoEdit={Boolean(autoEditTarget && autoEditTarget.escIdx === 0 && autoEditTarget.actIdx === j)}
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
                <PanelEmptyDropZone color={color} onDropAction={(action) => handleAppend(idx, action)} />
              ) : (
                esc.actions.map((a, j) => (
                  <ActionRowDnDWrapper
                    key={j}
                    escalationIdx={idx}
                    actionIdx={j}
                    action={a}
                    onMoveAction={moveAction}
                    onDropNewAction={(action, to, pos) => handleDropFromViewer(action, to, pos)}
                    allowViewerDrop={true}
                  >
                    <ActionRow
                      icon={getActionIconNode(a.actionId, ensureHexColor(a.color))}
                      text={getText(a)}
                      color={color}
                      draggable
                      selected={false}
                      actionId={a.actionId}
                      label={getActionLabel(a.actionId)}
                      onEdit={a.actionId === 'sayMessage' ? (newText) => editAction(idx, j, newText) : undefined}
                      onDelete={() => deleteAction(idx, j)}
                      autoEdit={Boolean(autoEditTarget && autoEditTarget.escIdx === idx && autoEditTarget.actIdx === j)}
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


