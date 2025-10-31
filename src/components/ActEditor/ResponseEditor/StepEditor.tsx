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
        return { actionId: a.actionId, text, textKey, color: a.color };
      })
    }));
  }

  // Case B: steps as array [{ type: 'start', escalations: [...] }, ...]
  if (Array.isArray(node?.steps)) {
    const group = (node.steps as any[]).find((g: any) => (g?.type === stepKey));
    if (group && Array.isArray(group.escalations)) {
      console.error('🔍 [RE][buildModel] Using Case B (array steps)', {
        stepKey,
        escalationsCount: group.escalations.length,
        nodeLabel: node?.label,
        nodeId: node?.id,
        // Verifica le actions del primo escalation
        firstEscalationActions: group.escalations[0]?.actions || [],
        firstActionTextKey: group.escalations[0]?.actions?.[0]?.parameters?.find((p: any) => p?.parameterId === 'text')?.value,
        firstActionText: group.escalations[0]?.actions?.[0]?.text,
        firstActionFull: group.escalations[0]?.actions?.[0]
      });
      return (group.escalations as any[]).map((esc: any) => ({
        actions: (esc.actions || []).map((a: any) => {
          const p = Array.isArray(a.parameters) ? a.parameters.find((x: any) => x?.parameterId === 'text') : undefined;
          const textKey = p?.value;

          // DEBUG: Log the raw action before processing
          console.error('🔍 [RE][buildModel] RAW ACTION', {
            nodeLabel: node?.label,
            nodeId: node?.id,
            stepKey,
            actionId: a.actionId,
            rawActionText: a.text,
            rawActionTextType: typeof a.text,
            rawActionTextLength: typeof a.text === 'string' ? a.text.length : 0,
            rawActionKeys: Object.keys(a || {}),
            rawActionFull: JSON.stringify(a).substring(0, 200)
          });

          // PRIORITY: Always use action.text if present (this is the edited text, saved directly on the action)
          // Only fallback to translations[textKey] if action.text is not available
          // This ensures that sub-data use their own edited text, not the main's textKey translations
          const text = (typeof a.text === 'string' && a.text.length > 0)
            ? a.text
            : (typeof textKey === 'string' ? (translations[textKey] || textKey) : undefined);

          console.error('🔍 [RE][buildModel] Action processed', {
            nodeLabel: node?.label,
            nodeId: node?.id,
            stepKey,
            actionId: a.actionId,
            textKey,
            text,
            finalText: text,
            hasDirectText: typeof a.text === 'string' && a.text.length > 0,
            textFromTranslations: typeof textKey === 'string' ? translations[textKey] : 'no textKey',
            // Verify if textKey points to wrong node
            textKeyContainsWrongNode: typeof textKey === 'string' && node?.label && !textKey.includes(node.label)
          });
          return { actionId: a.actionId, text, textKey, color: a.color };
        })
      }));
    } else {
      console.error('🔍 [RE][buildModel] Case B: No group found for stepKey', { stepKey, availableTypes: node.steps.map((g: any) => g?.type), nodeLabel: node?.label });
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

  // For introduction step, only allow playJingle and sayMessage actions
  const allowedActions = stepKey === 'introduction' ? ['playJingle', 'sayMessage'] : undefined;
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

  // FIX CRITICO: Usa una chiave unica per tracciare quando cambia nodo o stepKey
  // Quando cambia questa chiave, localModel deve essere resettato completamente
  const nodeStepKey = `${node?.id || ''}-${stepKey}`;

  // Effect 1: Resetta localModel quando cambia nodo o stepKey (priorità assoluta)
  React.useEffect(() => {
    // Quando cambia nodo o stepKey, resetta sempre localModel al nuovo model
    // Questo risolve il bug dove localModel conteneva dati del nodo precedente
    setLocalModel(model);
  }, [nodeStepKey, model]); // Reset quando cambia node.id o stepKey

  // Effect 2: Sincronizza quando cambia la struttura O il testo (quando viene da fonti esterne come Chat Simulator)
  // Quando l'utente modifica localmente in StepEditor, preserviamo le modifiche locali
  // Quando il cambiamento viene da fonti esterne (es. Chat Simulator), aggiorniamo localModel
  React.useEffect(() => {
    // Confronta sia struttura che testo per rilevare cambiamenti esterni
    const localSnapshot = JSON.stringify(localModel.map(e => ({
      actions: e.actions.map(a => ({
        actionId: a.actionId,
        textKey: a.textKey,
        text: a.text // Include text to detect external changes (e.g., from Chat Simulator)
      }))
    })));
    const modelSnapshot = JSON.stringify(model.map(e => ({
      actions: e.actions.map(a => ({
        actionId: a.actionId,
        textKey: a.textKey,
        text: a.text
      }))
    })));
    if (localSnapshot !== modelSnapshot) {
      // Model changed (structure or text), update localModel
      // This will sync changes from external sources (e.g., Chat Simulator editing)
      setLocalModel(model);
    }
    // nodeStepKey nelle dipendenze evita esecuzione quando cambia nodo
    // (quando cambia nodo, l'effect 1 resetta già localModel)
  }, [model, localModel, nodeStepKey]);

  // Commit esplicito: chiamato solo da useActionCommands dopo ogni azione (drop, append, edit, delete, move)
  const commitUp = React.useCallback((next: EscalationModel[]) => {
    console.error('🔍 [StepEditor][commitUp] Notifying parent of change', {
      stepKey,
      escalationsCount: next.length,
      nodeLabel: node?.label,
      nodeId: node?.id,
      firstActionText: next[0]?.actions?.[0]?.text,
      firstActionTextKey: next[0]?.actions?.[0]?.textKey
    });
    try {
      onModelChange?.(next);
      console.error('🔍 [StepEditor][commitUp] onModelChange called successfully');
    } catch (error) {
      console.error('🔍 [StepEditor][commitUp] ERROR calling onModelChange', error);
    }
  }, [onModelChange, stepKey, node]);
  const { editAction, deleteAction, moveAction, dropFromViewer, appendAction } = useActionCommands(setLocalModel as any, commitUp as any);

  // Priorità: a.text (UI-local) > translations[a.textKey] (persisted)
  const getText = (a: any) => (a.text || (typeof a.textKey === 'string' ? translations[a.textKey] : '') || '');

  // const handleQuickAdd = () => {
  //   // Azione base: sayMessage vuota
  //   appendAction(0, { actionId: 'sayMessage', text: '' } as any);
  // };

  // Auto-focus editing after drop/append
  const [autoEditTarget, setAutoEditTarget] = React.useState<{ escIdx: number; actIdx: number } | null>(null);

  // Track which row is currently being edited (for disabling drag)
  const [editingRows, setEditingRows] = React.useState<Set<string>>(new Set());

  const handleEditingChange = React.useCallback((escalationIdx: number, actionIdx: number) => (isEditing: boolean) => {
    const key = `${escalationIdx}-${actionIdx}`;
    setEditingRows(prev => {
      const next = new Set(prev);
      if (isEditing) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  }, []);

  // Wrapper per editAction che resetta autoEditTarget quando l'edit è completato
  const handleEdit = React.useCallback((escalationIdx: number, actionIdx: number, newText: string) => {
    console.error('🔍 [StepEditor][handleEdit] Called', {
      stepKey,
      nodeLabel: node?.label,
      escalationIdx,
      actionIdx,
      newText,
      oldText: localModel[escalationIdx]?.actions?.[actionIdx]?.text
    });
    editAction(escalationIdx, actionIdx, newText);
    // Reset autoEditTarget se corrisponde all'azione editata
    if (autoEditTarget && autoEditTarget.escIdx === escalationIdx && autoEditTarget.actIdx === actionIdx) {
      setAutoEditTarget(null);
    }
  }, [editAction, autoEditTarget, stepKey, node, localModel]);

  // Wrapper per deleteAction che resetta autoEditTarget quando l'azione viene eliminata
  const handleDelete = React.useCallback((escalationIdx: number, actionIdx: number) => {
    deleteAction(escalationIdx, actionIdx);
    // Reset se l'azione eliminata era il target
    if (autoEditTarget && autoEditTarget.escIdx === escalationIdx && autoEditTarget.actIdx === actionIdx) {
      setAutoEditTarget(null);
    }
    // Aggiorna indici se l'azione eliminata era prima del target
    else if (autoEditTarget && autoEditTarget.escIdx === escalationIdx && autoEditTarget.actIdx > actionIdx) {
      setAutoEditTarget({ ...autoEditTarget, actIdx: autoEditTarget.actIdx - 1 });
    }
  }, [deleteAction, autoEditTarget]);

  const handleAppend = React.useCallback((escIdx: number, action: any) => {
    // Validate: for introduction step, only allow playJingle and sayMessage
    if (allowedActions && allowedActions.length > 0) {
      const actionId = action?.actionId || action?.id || '';
      if (!allowedActions.includes(actionId)) {
        console.warn('[StepEditor] Action not allowed in introduction step:', actionId, 'Allowed:', allowedActions);
        return; // Reject the action
      }
    }
    const currentLen = (localModel?.[escIdx]?.actions?.length) || 0;
    appendAction(escIdx, action);
    setAutoEditTarget({ escIdx, actIdx: currentLen });
  }, [appendAction, localModel, allowedActions]);

  const handleDropFromViewer = React.useCallback((incoming: any, to: { escalationIdx: number; actionIdx: number }, position: 'before' | 'after') => {
    // Validate: for introduction step, only allow playJingle and sayMessage
    if (allowedActions && allowedActions.length > 0) {
      const actionId = incoming?.actionId || incoming?.id || '';
      if (!allowedActions.includes(actionId)) {
        console.warn('[StepEditor] Action not allowed in introduction step:', actionId, 'Allowed:', allowedActions);
        return; // Reject the drop
      }
    }
    const targetIdx = position === 'after' ? to.actionIdx + 1 : to.actionIdx;
    dropFromViewer(incoming, to, position);
    setAutoEditTarget({ escIdx: to.escalationIdx, actIdx: targetIdx });
  }, [dropFromViewer, allowedActions]);

  return (
    <div style={{ padding: 16 }}>
      {/* Title removed to avoid redundancy with step tabs */}
      {/* Escalation boxes (singoli) */}
      {localModel.length === 0 && (
        <div style={{ color: '#94a3b8', fontStyle: 'italic' }}>No escalation/actions for this step.</div>
      )}
      {['start', 'success', 'introduction'].includes(stepKey) ? (
        // Per start/success: canvas droppabile per append; i row wrapper non accettano drop dal viewer
        <CanvasDropWrapper onDropAction={(action) => handleAppend(0, action)} color={color}>
          {localModel[0]?.actions?.map((a, j) => {
            const editingKey = `0-${j}`;
            const isEditing = editingRows.has(editingKey);
            return (
              <ActionRowDnDWrapper
                key={j}
                escalationIdx={0}
                actionIdx={j}
                action={a}
                onMoveAction={moveAction}
                onDropNewAction={(action, to, pos) => handleDropFromViewer(action, to, pos)}
                allowViewerDrop={true}
                isEditing={isEditing}
              >
                <ActionRow
                  icon={getActionIconNode(a.actionId, ensureHexColor(a.color))}
                  text={getText(a)}
                  color={color}
                  draggable
                  selected={false}
                  actionId={a.actionId}
                  label={getActionLabel(a.actionId)}
                  onEdit={a.actionId === 'sayMessage' ? (newText) => handleEdit(0, j, newText) : undefined}
                  onDelete={() => handleDelete(0, j)}
                  autoEdit={Boolean(autoEditTarget && autoEditTarget.escIdx === 0 && autoEditTarget.actIdx === j)}
                  onEditingChange={handleEditingChange(0, j)}
                />
              </ActionRowDnDWrapper>
            );
          })}
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
                esc.actions.map((a, j) => {
                  const editingKey = `${idx}-${j}`;
                  const isEditing = editingRows.has(editingKey);
                  return (
                    <ActionRowDnDWrapper
                      key={j}
                      escalationIdx={idx}
                      actionIdx={j}
                      action={a}
                      onMoveAction={moveAction}
                      onDropNewAction={(action, to, pos) => handleDropFromViewer(action, to, pos)}
                      allowViewerDrop={true}
                      isEditing={isEditing}
                    >
                      <ActionRow
                        icon={getActionIconNode(a.actionId, ensureHexColor(a.color))}
                        text={getText(a)}
                        color={color}
                        draggable
                        selected={false}
                        actionId={a.actionId}
                        label={getActionLabel(a.actionId)}
                        onEdit={a.actionId === 'sayMessage' ? (newText) => handleEdit(idx, j, newText) : undefined}
                        onDelete={() => handleDelete(idx, j)}
                        autoEdit={Boolean(autoEditTarget && autoEditTarget.escIdx === idx && autoEditTarget.actIdx === j)}
                        onEditingChange={handleEditingChange(idx, j)}
                      />
                    </ActionRowDnDWrapper>
                  );
                })
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}


