import React from 'react';
import TaskRowDnDWrapper from './TaskRowDnDWrapper';
import TaskRow from './TaskRow';
import { getTaskIconNode, getTaskLabel } from './taskMeta';
import getIconComponent from './icons';
import { ensureHexColor } from './utils/color';
import CanvasDropWrapper from './CanvasDropWrapper';
import PanelEmptyDropZone from './PanelEmptyDropZone';

type EscalationEditorProps = {
  escalation: any; // ✅ Singola escalation (fonte di verità)
  escalationIdx: number;
  translations: Record<string, string>;
  color?: string;
  allowedActions?: string[];
  onEscalationChange: (newEscalation: any) => void; // ✅ Passa solo la nuova escalation
  onMoveTask: (
    fromEscIdx: number,
    fromTaskIdx: number,
    toEscIdx: number,
    toTaskIdx: number,
    position: 'before' | 'after'
  ) => void; // ✅ Per spostare task tra escalations
  autoEditTarget: { escIdx: number; actIdx: number } | null;
  onAutoEditTargetChange: (target: { escIdx: number; actIdx: number } | null) => void;
};

export default function EscalationEditor({
  escalation,
  escalationIdx,
  translations,
  color = '#fb923c',
  allowedActions,
  onEscalationChange,
  onMoveTask,
  autoEditTarget,
  onAutoEditTargetChange
}: EscalationEditorProps) {
  // ✅ Helper per generare un GUID valido
  const generateGuid = React.useCallback(() => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }, []);

  // ✅ Helper per ottenere il testo di una task direttamente dal node
  const getText = React.useCallback((task: any) => {
    // Se ha text diretto, usalo
    if (task.text && typeof task.text === 'string' && task.text.trim().length > 0) {
      return task.text;
    }

    // Altrimenti cerca textKey nei parameters
    const textKeyParam = task.parameters?.find((p: any) => p?.parameterId === 'text');
    const textKey = textKeyParam?.value;

    if (textKey && typeof textKey === 'string') {
      // Se è un GUID valido, cerca la traduzione
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(textKey)) {
        return translations[textKey] || textKey;
      }
      // Altrimenti usa direttamente il textKey
      return textKey;
    }

    // Se non ha text e non è sayMessage, usa il label del template
    if (task.templateId && task.templateId !== 'sayMessage') {
      return getTaskLabel(task.templateId) || '';
    }

    return '';
  }, [translations]);

  const [editingRows, setEditingRows] = React.useState<Set<number>>(new Set());

  const handleEditingChange = React.useCallback((taskIdx: number) => (isEditing: boolean) => {
    setEditingRows(prev => {
      const next = new Set(prev);
      if (isEditing) {
        next.add(taskIdx);
      } else {
        next.delete(taskIdx);
      }
      return next;
    });
  }, []);

  // ✅ Modifica una task in questa escalation
  const handleEdit = React.useCallback((taskIdx: number, newText: string) => {
    const tasks = [...(escalation.tasks || [])];
    tasks[taskIdx] = { ...tasks[taskIdx], text: newText };
    onEscalationChange({ ...escalation, tasks });

    if (autoEditTarget && autoEditTarget.escIdx === escalationIdx && autoEditTarget.actIdx === taskIdx) {
      onAutoEditTargetChange(null);
    }
  }, [escalation, escalationIdx, onEscalationChange, autoEditTarget, onAutoEditTargetChange]);

  // ✅ Elimina una task da questa escalation
  const handleDelete = React.useCallback((taskIdx: number) => {
    const tasks = (escalation.tasks || []).filter((_: any, j: number) => j !== taskIdx);
    onEscalationChange({ ...escalation, tasks });

    if (autoEditTarget && autoEditTarget.escIdx === escalationIdx && autoEditTarget.actIdx === taskIdx) {
      onAutoEditTargetChange(null);
    }
  }, [escalation, escalationIdx, onEscalationChange, autoEditTarget, onAutoEditTargetChange]);

  // ✅ Aggiungi una task a questa escalation (drop su zona vuota)
  const handleAppend = React.useCallback((task: any) => {
    if (allowedActions && allowedActions.length > 0) {
      const templateId = task?.templateId || task?.id || '';
      if (!allowedActions.includes(templateId)) {
        return;
      }
    }

    const taskRef = {
      templateId: task.templateId || 'sayMessage',
      taskId: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      parameters: task.templateId === 'sayMessage'
        ? [{ parameterId: 'text', value: generateGuid() }]
        : (task.parameters || []),
      text: task.text,
      color: task.color
    };

    const tasks = [...(escalation.tasks || []), taskRef];
    onEscalationChange({ ...escalation, tasks });

    const newTaskIdx = tasks.length - 1;
    onAutoEditTargetChange({ escIdx: escalationIdx, actIdx: newTaskIdx });
  }, [escalation, escalationIdx, allowedActions, onEscalationChange, onAutoEditTargetChange, generateGuid]);

  // ✅ Drop di una task dal viewer in questa escalation
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

    const normalized = {
      templateId,
      taskId: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      parameters: templateId === 'sayMessage'
        ? [{ parameterId: 'text', value: generateGuid() }]
        : (incoming.parameters || task?.parameters || []),
      text: incoming.text || task?.text,
      color: incoming.color || task?.color,
      label: incoming.label || task?.label,
      iconName: incoming.icon || task?.iconName || task?.icon
    };

    const tasks = [...(escalation.tasks || [])];
    const insertIdx = position === 'after' ? to.taskIdx + 1 : to.taskIdx;
    tasks.splice(insertIdx, 0, normalized);

    onEscalationChange({ ...escalation, tasks });

    const targetIdx = position === 'after' ? to.taskIdx + 1 : to.taskIdx;
    if (templateId === 'sayMessage') {
      onAutoEditTargetChange({ escIdx: escalationIdx, actIdx: targetIdx });
    }
  }, [escalation, escalationIdx, allowedActions, onEscalationChange, onAutoEditTargetChange, generateGuid]);

  const tasks = escalation.tasks || [];

  return (
    <div style={{ marginBottom: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '0.875rem', color: '#666' }}>Escalation {escalationIdx + 1}</span>
      </div>
      <div style={{ padding: '0.5rem' }}>
        <CanvasDropWrapper onDropTask={handleAppend}>
          {tasks.length === 0 ? (
            <PanelEmptyDropZone color={color} onDropTask={handleAppend} />
          ) : (
            tasks.map((task: any, j: number) => {
              const isEditing = editingRows.has(j);
              const templateId = task.templateId || 'sayMessage';
              return (
                <TaskRowDnDWrapper
                  key={`${escalationIdx}-${j}-${task.taskId || j}`}
                  escalationIdx={escalationIdx}
                  taskIdx={j}
                  task={task}
                  onMoveTask={onMoveTask}
                  onDropNewTask={(task, to, pos) => handleDropFromViewer(task, to, pos)}
                  allowViewerDrop={true}
                  isEditing={isEditing}
                >
                  <TaskRow
                    icon={task.iconName
                      ? getIconComponent(task.iconName, ensureHexColor(task.color))
                      : getTaskIconNode(templateId, ensureHexColor(task.color))}
                    text={getText(task)}
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
      </div>
    </div>
  );
}

