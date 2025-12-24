import React from 'react';
import { Trash2 } from 'lucide-react';
import ActionRowDnDWrapper from './ActionRowDnDWrapper';
import ActionRow from './ActionRow';
import { getActionIconNode, getActionLabel } from './actionMeta';
import useActionCommands from './useActionCommands';
import { ensureHexColor } from './utils/color';
import CanvasDropWrapper from './CanvasDropWrapper';
import PanelEmptyDropZone from './PanelEmptyDropZone';
import { EscalationModel } from './utils/buildEscalationModel';

type Props = {
  escalations: EscalationModel[]; // ✅ Riceve direttamente le escalations
  translations: Record<string, string>;
  color?: string; // Colore per lo step (opzionale, default dal meta)
  allowedActions?: string[]; // Azioni permesse per questo step (opzionale)
  onDeleteEscalation?: (idx: number) => void;
  onDeleteAction?: (escIdx: number, actionIdx: number) => void;
  onModelChange?: (next: EscalationModel[]) => void; // ✅ Chiamato quando cambiano le escalations
};

export default function StepEditor({
  escalations,
  translations,
  color = '#fb923c',
  allowedActions,
  onDeleteEscalation,
  onModelChange
}: Props) {
  // ✅ Lavora direttamente su escalations, senza derivazioni
  const [localEscalations, setLocalEscalations] = React.useState(escalations);

  // ✅ Sincronizza solo quando escalations cambia (nuovo step/nodo)
  React.useEffect(() => {
    setLocalEscalations(escalations);
  }, [escalations]);

  // ✅ commitUp: filtra escalation vuote e chiama onModelChange
  const commitUp = React.useCallback((next: EscalationModel[]) => {
    const filtered = next.filter(esc => (esc.tasks || []).length > 0);
    onModelChange?.(filtered);
  }, [onModelChange]);

  const { editTask, deleteTask, moveTask, dropTaskFromViewer, appendTask } = useActionCommands(setLocalEscalations as any, commitUp as any);

  // Effect 3: Elimina escalation vuote quando si perde il focus o si clicca fuori
  // Questo previene "fantasmi" (escalation vuote che rimangono)
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const cleanupEmptyRows = () => {
      setLocalEscalations(prev => {
        // Remove empty tasks from each escalation
        const cleaned = prev.map(esc => {
          const tasks = (esc.tasks || []).filter((task: any) => {
            const taskText = task.text || '';
            const textKey = task.textKey || '';
            // Keep task if it has text or a valid textKey (GUID)
            return taskText.trim().length > 0 || (textKey && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(textKey));
          });
          return { ...esc, tasks };
        });

        // Remove escalations that have no tasks
        const filtered = cleaned.filter(esc => (esc.tasks || []).length > 0);

        if (filtered.length !== prev.length || cleaned.some((esc, idx) => (esc.tasks || []).length !== (prev[idx]?.tasks || []).length)) {
          // If we removed anything, commit the change
          commitUp(filtered);
          return filtered;
        }
        return prev;
      });
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        // Small delay to allow blur handlers to complete first
        setTimeout(() => {
          cleanupEmptyRows();
        }, 150);
      }
    };

    const handleWindowBlur = () => {
      setTimeout(() => {
        cleanupEmptyRows();
      }, 150);
    };

    // Listen for clicks outside the component
    document.addEventListener('mousedown', handleClickOutside);
    // Listen for window blur (when user switches tabs)
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [commitUp]);

  const getText = (task: any) => (task.text || (typeof task.textKey === 'string' ? translations[task.textKey] : '') || '');

  const [autoEditTarget, setAutoEditTarget] = React.useState<{ escIdx: number; actIdx: number } | null>(null);
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

  // Effect 4: Elimina tutte le righe vuote quando si clicca sul canvas
  React.useEffect(() => {
    const handleCanvasClick = () => {
      setLocalEscalations(prev => {
        // Remove empty tasks from each escalation
        const cleaned = prev.map((esc, escIdx) => {
          const tasks = (esc.tasks || []).filter((task: any, taskIdx: number) => {
            const taskText = task.text || '';
            const textKey = task.textKey || '';
            const trimmedText = taskText.trim();
            const hasValidTextKey = textKey && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(textKey);

            // Keep task if it has text or a valid textKey (GUID)
            const keep = trimmedText.length > 0 || hasValidTextKey;

            if (!keep) {
              // Remove from editingRows
              const key = `${escIdx}-${taskIdx}`;
              setEditingRows(prevRows => {
                const nextRows = new Set(prevRows);
                nextRows.delete(key);
                return nextRows;
              });
            }

            return keep;
          });
          return { ...esc, tasks };
        });

        // Remove escalations that have no tasks
        const filtered = cleaned.filter(esc => (esc.tasks || []).length > 0);

        // If we removed anything, commit the change
        if (filtered.length !== prev.length || cleaned.some((esc, idx) => (esc.tasks || []).length !== (prev[idx]?.tasks || []).length)) {
          commitUp(filtered);
          return filtered;
        }

        return prev;
      });
    };

    // Listen for canvas click events
    window.addEventListener('flow:canvas:click', handleCanvasClick as any);
    return () => window.removeEventListener('flow:canvas:click', handleCanvasClick as any);
  }, [commitUp]);

  const handleEdit = React.useCallback((escalationIdx: number, taskIdx: number, newText: string) => {
    editTask(escalationIdx, taskIdx, newText);
    if (autoEditTarget && autoEditTarget.escIdx === escalationIdx && autoEditTarget.actIdx === taskIdx) {
      setAutoEditTarget(null);
    }
  }, [editTask, autoEditTarget]);

  const handleDelete = React.useCallback((escalationIdx: number, taskIdx: number) => {
    deleteTask(escalationIdx, taskIdx);
    if (autoEditTarget && autoEditTarget.escIdx === escalationIdx && autoEditTarget.actIdx === taskIdx) {
      setAutoEditTarget(null);
    }
  }, [deleteTask, autoEditTarget]);

  const handleAppend = React.useCallback((escIdx: number, action: any) => {
    if (allowedActions && allowedActions.length > 0) {
      const templateId = action?.templateId || action?.actionId || action?.id || '';
      if (!allowedActions.includes(templateId)) {
        console.warn('[StepEditor] Task not allowed in introduction step:', templateId, 'Allowed:', allowedActions);
        return;
      }
    }
    const currentLen = localEscalations?.[escIdx]?.tasks?.length || 0;
    const taskRef = {
      templateId: action.templateId || action.actionId || 'sayMessage',
      taskId: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      parameters: action.parameters || [],
      text: action.text,
      color: action.color
    };
    appendTask(escIdx, taskRef);
    setAutoEditTarget({ escIdx, actIdx: currentLen });
  }, [appendTask, localEscalations, allowedActions]);

  const handleDropFromViewer = React.useCallback((incoming: any, to: { escalationIdx: number; taskIdx: number }, position: 'before' | 'after') => {
    if (allowedActions && allowedActions.length > 0) {
      const templateId = incoming?.templateId || incoming?.actionId || incoming?.id || '';
      if (!allowedActions.includes(templateId)) {
        return;
      }
    }

    dropTaskFromViewer(incoming, to, position);

    const targetIdx = position === 'after' ? to.taskIdx + 1 : to.taskIdx;
    const templateId = incoming?.templateId || incoming?.actionId || incoming?.id || '';
    if (templateId === 'sayMessage') {
      setAutoEditTarget({ escIdx: to.escalationIdx, actIdx: targetIdx });
    }
  }, [dropTaskFromViewer, allowedActions]);

  return (
    <div ref={containerRef} className="step-editor" style={{ padding: '1rem' }}>
      {localEscalations.length === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
          No escalations
        </div>
      ) : (
        localEscalations.map((esc, idx) => (
          <div key={idx} style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.875rem', color: '#666' }}>Escalation {idx + 1}</span>
              {onDeleteEscalation && (
                <button
                  onClick={() => onDeleteEscalation(idx)}
                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
            <div style={{ padding: '0.5rem' }}>
              <CanvasDropWrapper onDropTask={(task) => handleAppend(idx, task)}>
                {(esc.tasks || []).length === 0 ? (
                  <PanelEmptyDropZone color={color} onDropTask={(task) => handleAppend(idx, task)} />
                ) : (
                  (esc.tasks || []).map((task: any, j: number) => {
                    const editingKey = `${idx}-${j}`;
                    const isEditing = editingRows.has(editingKey);
                    const templateId = task.templateId || 'sayMessage';
                    return (
                      <ActionRowDnDWrapper
                        key={j}
                        escalationIdx={idx}
                        taskIdx={j}
                        task={task}
                        onMoveTask={moveTask}
                        onDropNewTask={(task, to, pos) => handleDropFromViewer(task, to, pos)}
                        allowViewerDrop={true}
                        isEditing={isEditing}
                      >
                        <ActionRow
                          icon={getActionIconNode(templateId, ensureHexColor(task.color))}
                          text={getText(task)}
                          color={color}
                          draggable
                          selected={false}
                          actionId={templateId}
                          label={task.label || getActionLabel(templateId)}
                          onEdit={templateId === 'sayMessage' ? (newText) => handleEdit(idx, j, newText) : undefined}
                          onDelete={() => handleDelete(idx, j)}
                          autoEdit={Boolean(autoEditTarget && autoEditTarget.escIdx === idx && autoEditTarget.actIdx === j)}
                          onEditingChange={(isEditing) => {
                            handleEditingChange(idx, j)(isEditing);
                            if (!isEditing && autoEditTarget && autoEditTarget.escIdx === idx && autoEditTarget.actIdx === j) {
                              setAutoEditTarget(null);
                            }
                          }}
                        />
                      </ActionRowDnDWrapper>
                    );
                  })
                )}
              </CanvasDropWrapper>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
