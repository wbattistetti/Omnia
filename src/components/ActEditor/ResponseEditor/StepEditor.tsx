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

type EscalationModel = {
  tasks?: Array<{ templateId?: string; taskId?: string; text?: string; textKey?: string; icon?: string; label?: string; color?: string; parameters?: Array<{ parameterId: string; value: string }> }>;
};

function buildModel(node: any, stepKey: string, translations: Record<string, string>): EscalationModel[] {
  // Case A: steps as object { start: { escalations: [...] } }
  if (node?.steps && !Array.isArray(node.steps) && node.steps[stepKey] && Array.isArray(node.steps[stepKey].escalations)) {
    const escs = node.steps[stepKey].escalations as any[];
    return escs.map((esc) => {
      const taskRefs = esc.tasks || esc.actions || [];
      return {
        tasks: taskRefs.map((task: any) => {
          const p = Array.isArray(task.parameters) ? task.parameters.find((x: any) => x?.parameterId === 'text') : undefined;
          const textKey = p?.value || task.taskId;
          const hasDirectText = typeof task.text === 'string' && task.text.length > 0;
          const translationValue = typeof textKey === 'string' ? translations[textKey] : undefined;
          const text = hasDirectText
            ? task.text
            : (typeof textKey === 'string' ? (translationValue || textKey) : undefined);

          if (textKey && !translationValue && !hasDirectText) {
            const isGuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(textKey);
            console.warn('[StepEditor][buildModel] ❌ Translation NOT FOUND', {
              stepKey,
              nodeLabel: node?.label,
              textKey,
              isGuid,
              taskId: task.taskId,
              templateId: task.templateId,
              hasTaskText: hasDirectText
            });
          }

          return { templateId: task.templateId, taskId: task.taskId, text, textKey, color: task.color, label: task.label };
        })
      };
    });
  }

  // Case B: steps as array [{ type: 'start', escalations: [...] }, ...]
  if (Array.isArray(node?.steps)) {
    const group = (node.steps as any[]).find((g: any) => (g?.type === stepKey));
    if (group && Array.isArray(group.escalations)) {
      return (group.escalations as any[]).map((esc: any) => ({
        tasks: (esc.tasks || esc.actions || []).map((task: any) => {
          const p = Array.isArray(task.parameters) ? task.parameters.find((x: any) => x?.parameterId === 'text') : undefined;
          const textKey = p?.value;
          const text = (typeof task.text === 'string' && task.text.length > 0)
            ? task.text
            : (typeof textKey === 'string' ? (translations[textKey] || textKey) : undefined);
          return { templateId: task.templateId, taskId: task.taskId, text, textKey, color: task.color, label: task.label };
        })
      }));
    }
  }

  // Fallback synthetic step from messages
  const msg = node?.messages?.[stepKey];
  if (msg && typeof msg.textKey === 'string') {
    const textKey = msg.textKey;
    const translationValue = translations[textKey];
    const text = translationValue || textKey;
    return [
      {
        tasks: [{ templateId: 'sayMessage', taskId: `task-${Date.now()}`, parameters: textKey ? [{ parameterId: 'text', value: textKey }] : [], text, textKey }]
      }
    ];
  }

  return [];
}

export default function StepEditor({ node, stepKey, translations, onDeleteEscalation, onModelChange }: Props) {
  const meta = (stepMeta as any)[stepKey];
  const color = meta?.color || '#fb923c';
  const allowedActions = stepKey === 'introduction' ? ['playJingle', 'sayMessage'] : undefined;

  const model = React.useMemo(() => {
    return buildModel(node, stepKey, translations);
  }, [node, stepKey, translations]);

  // ✅ SOLUZIONE SEMPLICE: localModel è la fonte di verità per l'UI
  const nodeStepKey = `${node?.id || ''}-${stepKey}`;
  const [localModel, setLocalModel] = React.useState(model);
  const prevNodeStepKeyRef = React.useRef(nodeStepKey);
  const pendingCommitRef = React.useRef<EscalationModel[] | null>(null);

  // Effect 1: Resetta localModel quando cambia nodeStepKey (nuovo nodo/step)
  React.useEffect(() => {
    if (prevNodeStepKeyRef.current !== nodeStepKey) {
      prevNodeStepKeyRef.current = nodeStepKey;
      setLocalModel(model);
      pendingCommitRef.current = null;
    }
  }, [nodeStepKey, model]);

  // Effect 2: Sincronizza localModel con model quando model cambia DOPO una persistenza
  // Se abbiamo un pendingCommit e model corrisponde, significa che la persistenza è completata
  React.useEffect(() => {
    if (!pendingCommitRef.current) return;

    // Crea snapshot semplificato per confronto
    const modelSnapshot = JSON.stringify(model.map(e => ({
      tasks: (e.tasks || []).map(t => ({ templateId: t.templateId, taskId: t.taskId }))
    })));
    const pendingSnapshot = JSON.stringify(pendingCommitRef.current.map(e => ({
      tasks: (e.tasks || []).map(t => ({ templateId: t.templateId, taskId: t.taskId }))
    })));

    // Se model corrisponde a quello che abbiamo committato, sincronizza
    if (modelSnapshot === pendingSnapshot) {
      setLocalModel(model);
      pendingCommitRef.current = null;
    }
  }, [model]);


  // ✅ commitUp: salva il model che stiamo committando e chiama onModelChange
  // Filtra automaticamente escalation vuote per evitare "fantasmi"
  const commitUp = React.useCallback((next: EscalationModel[]) => {
    // Filter out empty escalations before committing
    const filtered = next.filter(esc => (esc.tasks || []).length > 0);
    pendingCommitRef.current = filtered;
    onModelChange?.(filtered);
  }, [onModelChange]);

  const { editTask, deleteTask, moveTask, dropTaskFromViewer, appendTask } = useActionCommands(setLocalModel as any, commitUp as any);

  // Effect 3: Elimina escalation vuote quando si perde il focus o si clicca fuori
  // Questo previene "fantasmi" (escalation vuote che rimangono)
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const cleanupEmptyRows = () => {
      setLocalModel(prev => {
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
      setLocalModel(prev => {
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
    const currentLen = localModel?.[escIdx]?.tasks?.length || 0;
    const taskRef = {
      templateId: action.templateId || action.actionId || 'sayMessage',
      taskId: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      parameters: action.parameters || [],
      text: action.text,
      color: action.color
    };
    appendTask(escIdx, taskRef);
    setAutoEditTarget({ escIdx, actIdx: currentLen });
  }, [appendTask, localModel, allowedActions]);

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
      {localModel.length === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
          No escalations
        </div>
      ) : (
        localModel.map((esc, idx) => (
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
