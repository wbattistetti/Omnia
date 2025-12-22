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
  // Removed verbose logging
  const shape = Array.isArray(node?.steps) ? 'array' : (node?.steps ? 'object' : 'none');
  const keys = node?.steps && !Array.isArray(node.steps) ? Object.keys(node.steps) : (Array.isArray(node?.steps) ? (node.steps as any[]).map((g: any) => g?.type) : []);

  // Case A: steps as object { start: { escalations: [...] } }
  if (node?.steps && !Array.isArray(node.steps) && node.steps[stepKey] && Array.isArray(node.steps[stepKey].escalations)) {
    const escs = node.steps[stepKey].escalations as any[];

    // ✅ CRITICAL: Log per sub-data start
    if (stepKey === 'start' && node.label && node.label !== node.label?.toUpperCase()) {
      // Removed verbose logging
      if (false) console.log('🔴 [CRITICAL] STEP_EDITOR - SUB-DATA START', {
        nodeLabel: node.label,
        stepKey,
        hasSteps: !!node.steps,
        hasStepKey: !!(node.steps && node.steps[stepKey]),
        escalationsCount: escs.length,
        escalations: escs.map((esc, idx) => ({
          idx,
          // ✅ MIGRATION: Support both tasks (new) and actions (legacy)
          hasActions: !!((esc.tasks || esc.actions) && Array.isArray(esc.tasks || esc.actions)),
          actionsCount: (esc.tasks || esc.actions) ? (esc.tasks || esc.actions).length : 0,
          firstAction: (esc.tasks?.[0] || esc.actions?.[0]) ? {
            actionId: (esc.tasks?.[0] || esc.actions?.[0])?.templateId || (esc.tasks?.[0] || esc.actions?.[0])?.actionId,
            hasParameters: !!((esc.tasks?.[0] || esc.actions?.[0])?.parameters && Array.isArray((esc.tasks?.[0] || esc.actions?.[0])?.parameters)),
            textKey: (esc.tasks?.[0] || esc.actions?.[0])?.parameters?.find((p: any) => p.parameterId === 'text')?.value,
            hasText: !!((esc.tasks?.[0] || esc.actions?.[0])?.text && (esc.tasks?.[0] || esc.actions?.[0])?.text.length > 0),
            text: (esc.tasks?.[0] || esc.actions?.[0])?.text
          } : null
        })),
        fullStep: node.steps[stepKey]
      });
    }

    // Removed verbose logging
    if (false) console.log('[STEP_EDITOR][buildModel] Case A: steps as object', {
      stepKey,
      escalationsCount: escs.length
    });

    console.log('[StepEditor][buildModel] 🔍 Processing escalations', {
      stepKey,
      nodeLabel: node?.label,
      escalationsCount: escs.length,
      translationsCount: Object.keys(translations).length,
      hasTasks: escs.some((e: any) => e.tasks && e.tasks.length > 0),
      hasActions: escs.some((e: any) => e.actions && e.actions.length > 0),
      firstEscalation: escs[0] ? {
        hasTasks: !!escs[0].tasks,
        tasksCount: escs[0].tasks?.length || 0,
        hasActions: !!escs[0].actions,
        actionsCount: escs[0].actions?.length || 0,
        firstTask: escs[0].tasks?.[0] ? {
          taskId: escs[0].tasks[0].taskId,
          templateId: escs[0].tasks[0].templateId,
          hasParameters: !!escs[0].tasks[0].parameters,
          textParam: escs[0].tasks[0].parameters?.find((p: any) => p.parameterId === 'text')?.value
        } : null,
        firstAction: escs[0].actions?.[0] ? {
          actionId: escs[0].actions[0].actionId,
          actionInstanceId: escs[0].actions[0].actionInstanceId,
          hasParameters: !!escs[0].actions[0].parameters,
          textParam: escs[0].actions[0].parameters?.find((p: any) => p.parameterId === 'text')?.value
        } : null
      } : null
    });

    return escs.map((esc, escIdx) => {
      // ✅ Support both tasks (new) and actions (legacy)
      const taskRefs = esc.tasks || esc.actions || [];

      console.log(`[StepEditor][buildModel] 🔍 Processing escalation ${escIdx}`, {
        stepKey,
        nodeLabel: node?.label,
        escIdx,
        hasTasks: !!esc.tasks,
        tasksCount: esc.tasks?.length || 0,
        hasActions: !!esc.actions,
        actionsCount: esc.actions?.length || 0,
        taskRefsCount: taskRefs.length,
        firstTaskRef: taskRefs[0] ? {
          taskId: taskRefs[0].taskId,
          templateId: taskRefs[0].templateId,
          actionId: taskRefs[0].actionId,
          actionInstanceId: taskRefs[0].actionInstanceId,
          hasParameters: !!taskRefs[0].parameters,
          textParam: taskRefs[0].parameters?.find((p: any) => p.parameterId === 'text')?.value
        } : null
      });

      return {
        actions: taskRefs.map((task: any, taskIdx: number) => {
          const p = Array.isArray(task.parameters) ? task.parameters.find((x: any) => x?.parameterId === 'text') : undefined;
          const textKey = p?.value || task.taskId; // ✅ Use taskId as fallback if no text parameter
          const hasDirectText = typeof task.text === 'string' && task.text.length > 0;
          const translationValue = typeof textKey === 'string' ? translations[textKey] : undefined;
          const text = hasDirectText
            ? task.text
            : (typeof textKey === 'string' ? (translationValue || textKey) : undefined);

          console.log(`[StepEditor][buildModel] 🔍 Processing task ${taskIdx}`, {
            stepKey,
            nodeLabel: node?.label,
            escIdx,
            taskIdx,
            taskId: task.taskId,
            templateId: task.templateId,
            textKey,
            hasDirectText,
            hasTranslation: !!translationValue,
            translationValue: translationValue ? translationValue.substring(0, 50) : null,
            finalText: text ? text.substring(0, 50) : null,
            textKeyInTranslations: textKey in translations,
            translationsDictKeysCount: Object.keys(translations).length,
            sampleTranslationsKeys: Object.keys(translations).slice(0, 5)
          });

          // DEBUG: Log specifico quando non trova la translation
          if (textKey && !translationValue && !hasDirectText) {
            const isGuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(textKey);
            console.warn('[StepEditor][buildModel] ❌ Translation NOT FOUND', {
              stepKey,
              nodeLabel: node?.label,
              escIdx,
              taskIdx,
              textKey,
              isGuid,
              taskId: task.taskId,
              templateId: task.templateId,
              hasTaskText: hasDirectText,
              translationsDictKeysCount: Object.keys(translations).length,
              textKeyInDict: textKey in translations,
              sampleDictKeys: Object.keys(translations).slice(0, 10),
              matchingGuidsInDict: isGuid ? Object.keys(translations).filter(k => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(k)).slice(0, 10) : [],
              finalText: text,
              allTranslationsKeys: Object.keys(translations)
            });
          }

          return { actionId: task.templateId || task.actionId, text, textKey, color: task.color };
        })
      };
    });
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

    // Removed verbose logging
    if (false) console.log('[STEP_EDITOR][buildModel] Fallback from messages', {
      stepKey,
      textKey,
      hasTranslation: !!translationValue,
      translationValue: translationValue ? translationValue.substring(0, 50) : undefined,
      finalText: text ? text.substring(0, 50) : undefined
    });

    return [
      {
        tasks: [{ templateId: 'sayMessage', taskId: '', parameters: textKey ? [{ parameterId: 'text', value: textKey }] : [] }],  // ✅ New field
        actions: [{ actionId: 'sayMessage', text, textKey }]  // ✅ Legacy alias
      }
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
  const { editTask, deleteTask, moveTask, dropTaskFromViewer, appendTask } = useActionCommands(setLocalModel as any, commitUp as any);

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

  // Wrapper per editTask che resetta autoEditTarget quando l'edit è completato
  const handleEdit = React.useCallback((escalationIdx: number, taskIdx: number, newText: string) => {
    editTask(escalationIdx, taskIdx, newText);
    // Reset autoEditTarget se corrisponde all'azione editata
    if (autoEditTarget && autoEditTarget.escIdx === escalationIdx && autoEditTarget.actIdx === actionIdx) {
      setAutoEditTarget(null);
    }
  }, [editTask, autoEditTarget, stepKey, node, localModel]);

  // Wrapper per deleteTask che resetta autoEditTarget quando il task viene eliminato
  const handleDelete = React.useCallback((escalationIdx: number, taskIdx: number) => {
    deleteTask(escalationIdx, taskIdx);
    // Reset se l'azione eliminata era il target
    if (autoEditTarget && autoEditTarget.escIdx === escalationIdx && autoEditTarget.actIdx === actionIdx) {
      setAutoEditTarget(null);
    }
    // Aggiorna indici se l'azione eliminata era prima del target
    else if (autoEditTarget && autoEditTarget.escIdx === escalationIdx && autoEditTarget.actIdx > actionIdx) {
      setAutoEditTarget({ ...autoEditTarget, actIdx: autoEditTarget.actIdx - 1 });
    }
  }, [deleteTask, autoEditTarget]);

  const handleAppend = React.useCallback((escIdx: number, action: any) => {
    // Validate: for introduction step, only allow playJingle and sayMessage
    if (allowedActions && allowedActions.length > 0) {
      const actionId = action?.actionId || action?.id || '';
      if (!allowedActions.includes(actionId)) {
        console.warn('[StepEditor] Action not allowed in introduction step:', actionId, 'Allowed:', allowedActions);
        return; // Reject the action
      }
    }
    const currentLen = (localModel?.[escIdx]?.tasks?.length || localModel?.[escIdx]?.actions?.length) || 0;
    appendTask(escIdx, action);
    setAutoEditTarget({ escIdx, actIdx: currentLen });
  }, [appendTask, localModel, allowedActions]);

  const handleDropFromViewer = React.useCallback((incoming: any, to: { escalationIdx: number; taskIdx: number }, position: 'before' | 'after') => {
    // Validate: for introduction step, only allow playJingle and sayMessage
    if (allowedActions && allowedActions.length > 0) {
      const actionId = incoming?.actionId || incoming?.id || '';
      if (!allowedActions.includes(actionId)) {
        console.warn('[StepEditor] Task not allowed in introduction step:', actionId, 'Allowed:', allowedActions);
        return; // Reject the drop
      }
    }
    const targetIdx = position === 'after' ? to.taskIdx + 1 : to.taskIdx;
    dropTaskFromViewer(incoming, to, position);
    setAutoEditTarget({ escIdx: to.escalationIdx, actIdx: targetIdx });
  }, [dropTaskFromViewer, allowedActions]);

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
                onMoveAction={moveTask}
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


