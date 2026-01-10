import React from 'react';
import TaskRowDnDWrapper from '../../TaskRowDnDWrapper';
import TaskRow from '../../TaskRow';
import { getTaskIconNode, getTaskLabel } from '../../taskMeta';
import getIconComponent from '../../icons';
import { ensureHexColor } from '../../utils/color';
import CanvasDropWrapper from '../../CanvasDropWrapper';
import PanelEmptyDropZone from '../../PanelEmptyDropZone';
import { getTaskText, normalizeTaskForEscalation, generateGuid } from '../../utils/escalationHelpers';
import { useTaskEditing } from '../../hooks/useTaskEditing';
import { updateStepEscalations } from '../../utils/stepHelpers';

type EscalationTasksListProps = {
  escalation: any;
  escalationIdx: number;
  color: string;
  translations: Record<string, string>;
  allowedActions?: string[];
  updateEscalation: (updater: (esc: any) => any) => void;
  updateSelectedNode: (updater: (node: any) => any, notifyProvider?: boolean) => void;
  autoEditTarget: { escIdx: number; actIdx: number } | null;
  onAutoEditTargetChange: (target: { escIdx: number; actIdx: number } | null) => void;
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
  const tasks = escalation.tasks || [];

  // Handler per aggiungere task (drop su zona vuota)
  const handleAppend = React.useCallback((task: any) => {
    if (allowedActions && allowedActions.length > 0) {
      const templateId = task?.templateId || task?.id || '';
      if (!allowedActions.includes(templateId)) {
        return;
      }
    }

    const taskRef = normalizeTaskForEscalation(task);
    updateEscalation((esc) => {
      const newTasks = [...(esc.tasks || []), taskRef];
      const newTaskIdx = newTasks.length - 1;
      setTimeout(() => {
        onAutoEditTargetChange({ escIdx: escalationIdx, actIdx: newTaskIdx });
      }, 0);
      return { ...esc, tasks: newTasks };
    });
  }, [updateEscalation, escalationIdx, allowedActions, onAutoEditTargetChange]);

  // Handler per modificare task
  const handleEdit = React.useCallback((taskIdx: number, newText: string) => {
    updateEscalation((esc) => {
      const tasks = [...(esc.tasks || [])];
      tasks[taskIdx] = { ...tasks[taskIdx], text: newText };
      return { ...esc, tasks };
    });

    if (autoEditTarget && autoEditTarget.escIdx === escalationIdx && autoEditTarget.actIdx === taskIdx) {
      onAutoEditTargetChange(null);
    }
  }, [updateEscalation, escalationIdx, autoEditTarget, onAutoEditTargetChange]);

  // Handler per eliminare task
  const handleDelete = React.useCallback((taskIdx: number) => {
    updateEscalation((esc) => {
      const tasks = (esc.tasks || []).filter((_: any, j: number) => j !== taskIdx);
      return { ...esc, tasks };
    });

    if (autoEditTarget && autoEditTarget.escIdx === escalationIdx && autoEditTarget.actIdx === taskIdx) {
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

    const task = incoming?.task || incoming;
    const templateId = incoming?.templateId || task?.id || task?.templateId || '';

    if (allowedActions && allowedActions.length > 0) {
      if (!allowedActions.includes(templateId)) {
        return;
      }
    }

    const normalized = normalizeTaskForEscalation(incoming, generateGuid);

    const insertIdx = position === 'after' ? to.taskIdx + 1 : to.taskIdx;

    updateEscalation((esc) => {
      const tasks = [...(esc.tasks || [])];
      tasks.splice(insertIdx, 0, normalized);
      return { ...esc, tasks };
    });

    const targetIdx = position === 'after' ? to.taskIdx + 1 : to.taskIdx;
    if (templateId === 'sayMessage') {
      onAutoEditTargetChange({ escIdx: escalationIdx, actIdx: targetIdx });
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

        const tasks = [...(fromEsc.tasks || [])];
        const task = tasks[fromTaskIdx];
        if (!task) return escalations;

        // Rimuovi dalla posizione originale
        tasks.splice(fromTaskIdx, 1);
        updated[fromEscIdx] = { ...fromEsc, tasks };

        // Aggiungi alla nuova posizione
        if (!updated[toEscIdx]) {
          updated[toEscIdx] = { tasks: [] };
        }
        const toTasks = [...(updated[toEscIdx].tasks || [])];
        const insertIdx = position === 'after' ? toTaskIdx + 1 : toTaskIdx;
        toTasks.splice(insertIdx, 0, task);
        updated[toEscIdx] = { ...updated[toEscIdx], tasks: toTasks };

        return updated;
      });
    });
  }, [updateSelectedNode, stepKey]);

  return (
    <CanvasDropWrapper onDropTask={handleAppend}>
      {tasks.length === 0 ? (
        <PanelEmptyDropZone color={color} onDropTask={handleAppend} />
      ) : (
        tasks.map((task: any, j: number) => {
          const templateId = task.templateId || 'sayMessage';
          const isEditing = isEditingRow(j);

          return (
            <TaskRowDnDWrapper
              key={`${escalationIdx}-${j}-${task.id || j}`}
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
                label={task.label || getTaskLabel(templateId)}
                onEdit={templateId === 'sayMessage' ? (newText) => handleEdit(j, newText) : undefined}
                onDelete={() => handleDelete(j)}
                autoEdit={Boolean(autoEditTarget && autoEditTarget.escIdx === escalationIdx && autoEditTarget.actIdx === j)}
                onEditingChange={(isEditing) => {
                  handleEditingChange(j)(isEditing);
                  if (!isEditing && autoEditTarget && autoEditTarget.escIdx === escalationIdx && autoEditTarget.actIdx === j) {
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
