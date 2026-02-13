import React from 'react';
import TaskRowDnDWrapper from '@responseEditor/TaskRowDnDWrapper';
import TaskRow from '@responseEditor/TaskRow';
import { getTaskIconNode, getTaskLabel } from '@responseEditor/taskMeta';
import getIconComponent from '@responseEditor/icons';
import { ensureHexColor } from '@responseEditor/utils/color';
import CanvasDropWrapper from '@responseEditor/CanvasDropWrapper';
import PanelEmptyDropZone from '@responseEditor/PanelEmptyDropZone';
import { getTaskText, normalizeTaskForEscalation, generateGuid } from '@responseEditor/utils/escalationHelpers';
import { useTaskEditing } from '@responseEditor/hooks/useTaskEditing';
import { updateStepEscalations } from '@responseEditor/utils/stepHelpers';

type EscalationTasksListProps = {
  escalation: any;
  escalationIdx: number;
  color: string;
  translations: Record<string, string>;
  allowedActions?: string[];
  updateEscalation: (updater: (esc: any) => any) => void;
  updateSelectedNode: (updater: (node: any) => any, options?: { skipAutoSave?: boolean }) => void;
  autoEditTarget: { escIdx: number; taskIdx: number } | null;
  onAutoEditTargetChange: (target: { escIdx: number; taskIdx: number } | null) => void;
  stepKey: string;
};

export function EscalationTasksList({
  escalation,
  escalationIdx,
  color,
  translations,
  allowedActions,
  updateEscalation,
  updateSelectedNode,
  autoEditTarget,
  onAutoEditTargetChange,
  stepKey
}: EscalationTasksListProps) {
  const { handleEditingChange, isEditing: isEditingRow } = useTaskEditing();
  // ✅ NO FALLBACKS: escalation.tasks can be undefined (legitimate default)
  const tasks = escalation.tasks ?? [];

  // Handler per aggiungere task (drop su zona vuota)
  const handleAppend = React.useCallback((task: any) => {
    if (allowedActions && allowedActions.length > 0) {
      // After validation strict, task.id is always present
      // templateId is optional (preferred for lookup, but id works as fallback)
      const templateId = task?.templateId ?? task?.id ?? '';
      if (!allowedActions.includes(templateId)) {
        return;
      }
    }

    const taskRef = normalizeTaskForEscalation(task);
    updateEscalation((esc) => {
      const newTasks = [...(esc.tasks ?? []), taskRef];
      const newTaskIdx = newTasks.length - 1;
      setTimeout(() => {
        onAutoEditTargetChange({ escIdx: escalationIdx, taskIdx: newTaskIdx });
      }, 0);
      return { ...esc, tasks: newTasks };
    });
  }, [updateEscalation, escalationIdx, allowedActions, onAutoEditTargetChange]);

  // Handler per modificare task
  const handleEdit = React.useCallback((taskIdx: number, newText: string) => {
    updateEscalation((esc) => {
      const tasks = [...(esc.tasks ?? [])];
      tasks[taskIdx] = { ...tasks[taskIdx], text: newText };
      return { ...esc, tasks };
    });

    if (autoEditTarget && autoEditTarget.escIdx === escalationIdx && autoEditTarget.taskIdx === taskIdx) {
      onAutoEditTargetChange(null);
    }
  }, [updateEscalation, escalationIdx, autoEditTarget, onAutoEditTargetChange]);

  // Handler per eliminare task
  const handleDelete = React.useCallback((taskIdx: number) => {
    updateEscalation((esc) => {
      const tasks = (esc.tasks ?? []).filter((_: any, j: number) => j !== taskIdx);
      return { ...esc, tasks };
    });

    if (autoEditTarget && autoEditTarget.escIdx === escalationIdx && autoEditTarget.taskIdx === taskIdx) {
      onAutoEditTargetChange(null);
    }
  }, [updateEscalation, escalationIdx, autoEditTarget, onAutoEditTargetChange]);

  // Handler per drop di task dal viewer
  const handleDropFromViewer = React.useCallback((
    incoming: any,
    to: { escalationIdx: number; taskIdx: number },
    position: 'before' | 'after'
  ) => {
    // Se il drop è per un'altra escalation, non gestirlo qui
    if (to.escalationIdx !== escalationIdx) {
      return;
    }

    // ✅ Estrai il task dall'item (può essere in incoming.task o direttamente incoming)
    const task = incoming?.task || incoming;

    // ✅ Estrai templateId: se il task ha templateId, usalo; altrimenti usa id come templateId (per task dal pannello Tasks)
    // I task dal pannello Tasks hanno id che è l'id del template, quindi usalo come templateId
    // ✅ IMPORTANTE: templateId può essere null per task standalone, ma deve essere esplicitamente presente (non undefined)
    // After validation strict, task.id is always present
    // templateId is optional (preferred, but id works as fallback)
    const templateId = task?.templateId !== undefined
      ? task.templateId
      : (task?.id ?? null); // ✅ Usa id come templateId se templateId non è presente (per task dal pannello Tasks)

    // ✅ Estrai type: deve essere presente (TaskType enum)
    // Il type può essere in task.type (TaskType enum) o in incoming.type (ma questo è "TASK_VIEWER", non il TaskType)
    const taskType = task?.type !== undefined && task?.type !== null
      ? task.type
      : null;

    // ✅ Verifica che type sia presente (richiesto)
    if (taskType === undefined || taskType === null) {
      console.error('[handleDropFromViewer] Task is missing required field "type"', { incoming, task });
      return;
    }

    // ✅ Costruisci il task normalizzato con type e templateId espliciti
    // ✅ IMPORTANTE: templateId deve essere esplicitamente presente (può essere null, ma non undefined)
    // ✅ IMPORTANTE: type e templateId devono essere impostati DOPO lo spread per evitare sovrascritture
    const taskToNormalize = {
      ...task,
      type: taskType, // ✅ Imposta type esplicitamente (sovrascrive qualsiasi type da task)
      templateId: templateId // ✅ Imposta templateId esplicitamente (sovrascrive qualsiasi templateId da task, o aggiunge se mancante)
    };

    // 🔍 DEBUG: Verifica che taskToNormalize abbia type e templateId corretti
    if (typeof localStorage !== 'undefined' && localStorage.getItem('debug.drop') === '1') {
      console.log('[handleDropFromViewer] Task normalized', {
        taskType,
        templateId,
        taskToNormalize: {
          type: taskToNormalize.type,
          templateId: taskToNormalize.templateId,
          id: taskToNormalize.id
        }
      });
    }

    if (allowedActions && allowedActions.length > 0) {
      if (!allowedActions.includes(templateId)) {
        return;
      }
    }

    const normalized = normalizeTaskForEscalation(taskToNormalize, generateGuid);

    const insertIdx = position === 'after' ? to.taskIdx + 1 : to.taskIdx;

    updateEscalation((esc) => {
      const tasks = [...(esc.tasks ?? [])];
      tasks.splice(insertIdx, 0, normalized);
      return { ...esc, tasks };
    });

    const targetIdx = position === 'after' ? to.taskIdx + 1 : to.taskIdx;
    if (templateId === 'sayMessage') {
      onAutoEditTargetChange({ escIdx: escalationIdx, taskIdx: targetIdx });
    }
  }, [updateEscalation, escalationIdx, allowedActions, onAutoEditTargetChange]);

  // Handler per spostare task tra escalations diverse
  const handleMoveTask = React.useCallback((
    fromEscIdx: number,
    fromTaskIdx: number,
    toEscIdx: number,
    toTaskIdx: number,
    position: 'before' | 'after'
  ) => {
    updateSelectedNode((node) => {
      return updateStepEscalations(node, stepKey, (escalations) => {
        const updated = [...escalations];

        // Sposta task
        const fromEsc = updated[fromEscIdx];
        if (!fromEsc) return escalations;

        const tasks = [...(fromEsc.tasks ?? [])];
        const task = tasks[fromTaskIdx];
        if (!task) return escalations;

        // Rimuovi dalla posizione originale
        tasks.splice(fromTaskIdx, 1);
        updated[fromEscIdx] = { ...fromEsc, tasks };

        // Aggiungi alla nuova posizione
        if (!updated[toEscIdx]) {
          updated[toEscIdx] = { tasks: [] };
        }
        const toTasks = [...(updated[toEscIdx].tasks ?? [])];
        const insertIdx = position === 'after' ? toTaskIdx + 1 : toTaskIdx;
        toTasks.splice(insertIdx, 0, task);
        updated[toEscIdx] = { ...updated[toEscIdx], tasks: toTasks };

        return updated;
      });
    });
  }, [updateSelectedNode, stepKey]);

  return (
    <CanvasDropWrapper onDropTask={handleAppend} isEmpty={tasks.length === 0}>
      {tasks.length === 0 ? (
        <PanelEmptyDropZone color={color} onDropTask={handleAppend} />
      ) : (
        tasks.map((task: any, j: number) => {
          // ✅ NO FALLBACKS: templateId must exist, use 'sayMessage' only as explicit default for logging
          const templateId = task.templateId ?? 'sayMessage';
          const isEditing = isEditingRow(j);

          return (
            <TaskRowDnDWrapper
                key={`${escalationIdx}-${j}-${task.id ?? j}`}
              escalationIdx={escalationIdx}
              taskIdx={j}
              task={task}
              onMoveTask={handleMoveTask}
              onDropNewTask={(task, to, pos) => handleDropFromViewer(task, to, pos)}
              allowViewerDrop={true}
              isEditing={isEditing}
            >
              <TaskRow
                icon={task.iconName
                  ? getIconComponent(task.iconName, ensureHexColor(task.color))
                  : getTaskIconNode(templateId, ensureHexColor(task.color))}
                text={getTaskText(task, translations)}
                color={color}
                draggable
                selected={false}
                taskId={templateId}
                label={task.label ?? getTaskLabel(templateId)}
                onEdit={templateId === 'sayMessage' ? (newText) => handleEdit(j, newText) : undefined}
                onDelete={() => handleDelete(j)}
                autoEdit={Boolean(autoEditTarget && autoEditTarget.escIdx === escalationIdx && autoEditTarget.taskIdx === j)}
                onEditingChange={(isEditing) => {
                  handleEditingChange(j)(isEditing);
                  if (!isEditing && autoEditTarget && autoEditTarget.escIdx === escalationIdx && autoEditTarget.taskIdx === j) {
                    onAutoEditTargetChange(null);
                  }
                }}
              />
            </TaskRowDnDWrapper>
          );
        })
      )}
    </CanvasDropWrapper>
  );
}
