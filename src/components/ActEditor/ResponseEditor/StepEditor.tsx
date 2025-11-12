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
import { useFontContext } from '../../../context/FontContext';

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

  console.log('[STEP_EDITOR][buildModel] Building model', {
    stepKey,
    shape,
    availableSteps: keys,
    translationsCount: Object.keys(translations).length,
    sampleTranslationKeys: Object.keys(translations).slice(0, 5)
  });

  // Case A: steps as object { start: { escalations: [...] } }
  if (node?.steps && !Array.isArray(node.steps) && node.steps[stepKey] && Array.isArray(node.steps[stepKey].escalations)) {
    const escs = node.steps[stepKey].escalations as any[];

    // ✅ CRITICAL: Log per sub-data start
    if (stepKey === 'start' && node.label && node.label !== node.label?.toUpperCase()) {
      console.log('🔴 [CRITICAL] STEP_EDITOR - SUB-DATA START', {
        nodeLabel: node.label,
        stepKey,
        hasSteps: !!node.steps,
        hasStepKey: !!(node.steps && node.steps[stepKey]),
        escalationsCount: escs.length,
        escalations: escs.map((esc, idx) => ({
          idx,
          hasActions: !!(esc.actions && Array.isArray(esc.actions)),
          actionsCount: esc.actions ? esc.actions.length : 0,
          firstAction: esc.actions?.[0] ? {
            actionId: esc.actions[0].actionId,
            hasParameters: !!(esc.actions[0].parameters && Array.isArray(esc.actions[0].parameters)),
            textKey: esc.actions[0].parameters?.find((p: any) => p.parameterId === 'text')?.value,
            hasText: !!(esc.actions[0].text && esc.actions[0].text.length > 0),
            text: esc.actions[0].text
          } : null
        })),
        fullStep: node.steps[stepKey]
      });
    }

    console.log('[STEP_EDITOR][buildModel] Case A: steps as object', {
      stepKey,
      escalationsCount: escs.length
    });

    return escs.map((esc, escIdx) => ({
      actions: (esc.actions || []).map((a: any, actionIdx: number) => {
        const p = Array.isArray(a.parameters) ? a.parameters.find((x: any) => x?.parameterId === 'text') : undefined;
        const textKey = p?.value;
        const hasDirectText = typeof a.text === 'string' && a.text.length > 0;
        const translationValue = typeof textKey === 'string' ? translations[textKey] : undefined;
        const text = hasDirectText
          ? a.text
          : (typeof textKey === 'string' ? (translationValue || textKey) : undefined);

        // 🔍 DEBUG: Verifica tutte le chiavi runtime che iniziano con lo stesso prefisso
        const runtimeKeysWithSamePrefix = textKey ? Object.keys(translations).filter(k => {
          if (!k.startsWith('runtime.')) return false;
          const textKeyParts = textKey.split('.');
          const kParts = k.split('.');
          // Confronta i primi 3 segmenti (runtime, ddtId, guid)
          return textKeyParts.length >= 3 && kParts.length >= 3 &&
                 textKeyParts[0] === kParts[0] &&
                 textKeyParts[1] === kParts[1];
        }).slice(0, 5) : [];

        // 🔍 DEBUG: Verifica se la traduzione è in inglese o portoghese
        const translationIsEnglish = translationValue ? (
          translationValue.toLowerCase().includes('time?') ||
          translationValue.toLowerCase().includes('what time') ||
          translationValue.toLowerCase() === 'time?'
        ) : false;
        const translationIsPortuguese = translationValue ? (
          translationValue.toLowerCase().includes('hora') ||
          translationValue.toLowerCase().includes('horário') ||
          translationValue.toLowerCase().includes('que horas')
        ) : false;

        console.log('[STEP_EDITOR][buildModel] 🔍 ACTION RESOLVED - FULL DEBUG', {
          escIdx,
          actionIdx,
          stepKey,
          textKey,
          hasDirectText,
          hasTranslation: !!translationValue,
          translationValue: translationValue ? translationValue.substring(0, 50) : undefined,
          translationIsEnglish,
          translationIsPortuguese,
          finalText: text ? text.substring(0, 50) : undefined,
          translationKeyExists: textKey ? textKey in translations : false,
          // 🔍 VERIFICA tutte le chiavi runtime con lo stesso prefisso
          runtimeKeysWithSamePrefix: runtimeKeysWithSamePrefix.map(k => ({ key: k, value: translations[k]?.substring(0, 30) })),
          // 🔍 VERIFICA il valore esatto della traduzione
          exactTranslation: textKey ? translations[textKey] : undefined,
          // 🔍 VERIFICA se ci sono chiavi del template che potrebbero corrispondere
          templateKeys: textKey ? Object.keys(translations).filter(k => k.startsWith('template.') && (k.includes(textKey.split('.').pop() || '') || textKey.includes(k.split('.').pop() || ''))).slice(0, 5) : [],
          // 🔍 VERIFICA tutte le chiavi che contengono parti del textKey
          matchingKeys: textKey ? {
            exact: textKey in translations ? translations[textKey] : undefined,
            partial: Object.keys(translations).filter(k => k.includes(textKey.split('.').slice(-2).join('.'))).slice(0, 5).map(k => ({ key: k, value: translations[k] }))
          } : null,
          // 🔍 VERIFICA tutte le chiavi runtime per questo step
          allRuntimeKeysForStep: Object.keys(translations).filter(k => k.startsWith('runtime.') && k.includes(stepKey)).slice(0, 10),
          // 🔍 VERIFICA tutte le chiavi che iniziano con runtime.Time_
          allTimeRuntimeKeys: Object.keys(translations).filter(k => k.startsWith('runtime.') && k.includes('Time_')).slice(0, 10),
          // 🔍 VERIFICA tutte le traduzioni per le chiavi runtime.Time_
          timeRuntimeTranslations: Object.entries(translations)
            .filter(([k]) => k.startsWith('runtime.') && k.includes('Time_'))
            .slice(0, 5)
            .map(([k, v]) => ({ key: k, value: String(v).substring(0, 50) })),
          // 🔍 VERIFICA se la chiave specifica esiste e il suo valore
          keyLookup: textKey ? {
            exists: textKey in translations,
            value: translations[textKey],
            valueLength: translations[textKey] ? String(translations[textKey]).length : 0,
            valuePreview: translations[textKey] ? String(translations[textKey]).substring(0, 50) : undefined
          } : null,
          // 🔍 VERIFICA tutte le chiavi che contengono parti del textKey
          allKeysContainingParts: textKey ? {
            containsRuntime: Object.keys(translations).filter(k => k.includes('runtime.')).length,
            containsTime: Object.keys(translations).filter(k => k.includes('Time_')).length,
            containsStart: Object.keys(translations).filter(k => k.includes('start')).length,
            exactMatch: Object.keys(translations).filter(k => k === textKey).length
          } : null
        });

        return { actionId: a.actionId, text, textKey, color: a.color };
      })
    }));
  }

  // Case B: steps as array [{ type: 'start', escalations: [...] }, ...]
  if (Array.isArray(node?.steps)) {
    const group = (node.steps as any[]).find((g: any) => (g?.type === stepKey));
    if (group && Array.isArray(group.escalations)) {
      // Removed verbose log
      return (group.escalations as any[]).map((esc: any) => ({
        actions: (esc.actions || []).map((a: any) => {
          const p = Array.isArray(a.parameters) ? a.parameters.find((x: any) => x?.parameterId === 'text') : undefined;
          const textKey = p?.value;

          // Removed verbose log

          // PRIORITY: Always use action.text if present (this is the edited text, saved directly on the action)
          // Only fallback to translations[textKey] if action.text is not available
          // This ensures that sub-data use their own edited text, not the main's textKey translations
          const text = (typeof a.text === 'string' && a.text.length > 0)
            ? a.text
            : (typeof textKey === 'string' ? (translations[textKey] || textKey) : undefined);

          // Removed verbose log
          return { actionId: a.actionId, text, textKey, color: a.color };
        })
      }));
    } else {
      // Removed verbose log
    }
  }

  // Fallback synthetic step from messages
  const msg = node?.messages?.[stepKey];
  if (msg && typeof msg.textKey === 'string') {
    const textKey = msg.textKey;
    const translationValue = translations[textKey];
    const text = translationValue || textKey;

    console.log('[STEP_EDITOR][buildModel] Fallback from messages', {
      stepKey,
      textKey,
      hasTranslation: !!translationValue,
      translationValue: translationValue ? translationValue.substring(0, 50) : undefined,
      finalText: text ? text.substring(0, 50) : undefined
    });

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
      // Removed verbose log
      return [
        {
          actions: matches.map(k => ({ actionId: 'sayMessage', text: translations[k] || k, textKey: k }))
        }
      ];
    }
  } catch { }
  // Removed verbose log
  return [];
}

export default function StepEditor({ node, stepKey, translations, onDeleteEscalation, onModelChange }: Props) {
  const { combinedClass } = useFontContext();
  // No special-case: notConfirmed behaves like other steps (escalations UI)
  const meta = (stepMeta as any)[stepKey];
  const color = meta?.color || '#fb923c';

  // For introduction step, only allow playJingle and sayMessage actions
  const allowedActions = stepKey === 'introduction' ? ['playJingle', 'sayMessage'] : undefined;
  // const icon = meta?.icon || null;
  // const title = meta?.label || stepKey;

  const model = React.useMemo(() => {
    const result = buildModel(node, stepKey, translations);
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
    try {
      onModelChange?.(next);
    } catch (error) {
      console.error('[StepEditor][commitUp] ERROR calling onModelChange', error);
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


