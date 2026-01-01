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
  updateSelectedNode: (updater: (node: any) => any, notifyProvider?: boolean) => void; // ✅ Aggiorna direttamente selectedNode
  stepKey: string; // ✅ Step key corrente
  autoEditTarget: { escIdx: number; actIdx: number } | null;
  onAutoEditTargetChange: (target: { escIdx: number; actIdx: number } | null) => void;
};

export default function EscalationEditor({
  escalation,
  escalationIdx,
  translations,
  color = '#fb923c',
  allowedActions,
  updateSelectedNode,
  stepKey,
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

  // ✅ Helper per aggiornare escalation direttamente in selectedNode
  const updateEscalation = React.useCallback((updater: (escalation: any) => any) => {
    updateSelectedNode((node) => {
      const next = { ...node };

      // Gestisce entrambi i formati: array o oggetto
      if (Array.isArray(node.steps)) {
        const stepIdx = node.steps.findIndex((s: any) => s?.type === stepKey);
        if (stepIdx >= 0) {
          next.steps = [...node.steps];
          const step = next.steps[stepIdx];
          const escalations = [...(step.escalations || [])];
          escalations[escalationIdx] = updater(escalations[escalationIdx] || { tasks: [] });
          next.steps[stepIdx] = { ...step, escalations };
        }
      } else {
        next.steps = { ...(node.steps || {}) };
        if (!next.steps[stepKey]) {
          next.steps[stepKey] = { type: stepKey, escalations: [] };
        }
        const step = next.steps[stepKey];
        const escalations = [...(step.escalations || [])];
        escalations[escalationIdx] = updater(escalations[escalationIdx] || { tasks: [] });
        next.steps[stepKey] = { ...step, escalations };
      }

      return next;
    });
  }, [updateSelectedNode, stepKey, escalationIdx]);

  // ✅ Modifica una task in questa escalation
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

  // ✅ Elimina una task da questa escalation
  const handleDelete = React.useCallback((taskIdx: number) => {
    updateEscalation((esc) => {
      const tasks = (esc.tasks || []).filter((_: any, j: number) => j !== taskIdx);
      return { ...esc, tasks };
    });

    if (autoEditTarget && autoEditTarget.escIdx === escalationIdx && autoEditTarget.actIdx === taskIdx) {
      onAutoEditTargetChange(null);
    }
  }, [updateEscalation, escalationIdx, autoEditTarget, onAutoEditTargetChange]);

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

    updateEscalation((esc) => {
      const tasks = [...(esc.tasks || []), taskRef];
      const newTaskIdx = tasks.length - 1;
      // Usa setTimeout per evitare di chiamare onAutoEditTargetChange durante l'update
      setTimeout(() => {
        onAutoEditTargetChange({ escIdx: escalationIdx, actIdx: newTaskIdx });
      }, 0);
      return { ...esc, tasks };
    });
  }, [updateEscalation, updateSelectedNode, stepKey, escalationIdx, allowedActions, onAutoEditTargetChange, generateGuid]);

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
  }, [updateEscalation, escalationIdx, allowedActions, onAutoEditTargetChange, generateGuid]);

  // ✅ Gestisce spostamenti di task tra escalations diverse
  const handleMoveTask = React.useCallback((
    fromEscIdx: number,
    fromTaskIdx: number,
    toEscIdx: number,
    toTaskIdx: number,
    position: 'before' | 'after'
  ) => {
    updateSelectedNode((node) => {
      const next = { ...node };

      // Leggi escalations
      let escalations: any[];
      if (Array.isArray(node.steps)) {
        const step = node.steps.find((s: any) => s?.type === stepKey);
        escalations = [...(step?.escalations || [])];
      } else {
        escalations = [...(node.steps?.[stepKey]?.escalations || [])];
      }

      // Sposta task
      const fromEsc = escalations[fromEscIdx];
      if (!fromEsc) return node;

      const tasks = [...(fromEsc.tasks || [])];
      const task = tasks[fromTaskIdx];
      if (!task) return node;

      // Rimuovi dalla posizione originale
      tasks.splice(fromTaskIdx, 1);
      escalations[fromEscIdx] = { ...fromEsc, tasks };

      // Aggiungi alla nuova posizione
      if (!escalations[toEscIdx]) {
        escalations[toEscIdx] = { tasks: [] };
      }
      const toTasks = [...(escalations[toEscIdx].tasks || [])];
      const insertIdx = position === 'after' ? toTaskIdx + 1 : toTaskIdx;
      toTasks.splice(insertIdx, 0, task);
      escalations[toEscIdx] = { ...escalations[toEscIdx], tasks: toTasks };

      // Aggiorna node
      if (Array.isArray(node.steps)) {
        const stepIdx = node.steps.findIndex((s: any) => s?.type === stepKey);
        if (stepIdx >= 0) {
          next.steps = [...node.steps];
          next.steps[stepIdx] = { ...next.steps[stepIdx], escalations };
        }
      } else {
        next.steps = { ...(node.steps || {}) };
        next.steps[stepKey] = { ...next.steps[stepKey], escalations };
      }

      return next;
    });
  }, [updateSelectedNode, stepKey]);

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

