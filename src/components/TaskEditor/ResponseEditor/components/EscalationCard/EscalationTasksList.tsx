import React from 'react';
import TaskRowDnDWrapper from '@responseEditor/TaskRowDnDWrapper';
import TaskRow from '@responseEditor/TaskRow';
import { getTaskIconNode, getTaskLabel } from '@responseEditor/taskMeta';
import getIconComponent from '@responseEditor/icons';
import { ensureHexColor } from '@responseEditor/utils/color';
import CanvasDropWrapper from '@responseEditor/CanvasDropWrapper';
import PanelEmptyDropZone from '@responseEditor/PanelEmptyDropZone';
import {
  normalizeTaskForEscalation,
  generateGuid,
  isMessageLikeEscalationTask,
  isMessageSemanticTemplateId,
} from '@responseEditor/utils/escalationHelpers';
import { TaskType, templateIdToTaskType } from '@types/taskTypes';
import { useTaskEditing } from '@responseEditor/hooks/useTaskEditing';
import { updateStepEscalations } from '@responseEditor/utils/stepHelpers';
import { useProjectTranslations } from '@context/ProjectTranslationsContext';
import { useBehaviourUi } from '@responseEditor/behaviour/BehaviourUiContext';
import { TaskRowHeader } from '@responseEditor/tasks/TaskRowHeader';
import { TaskRowBody } from '@responseEditor/tasks/TaskRowBody';
import { ParameterFieldHost } from '@responseEditor/tasks/parameterEditors';
import { resolveTranslationKey } from '@responseEditor/utils/taskUiText';

function matchesAllowedTemplateId(templateId: string | null | undefined, allowed: string[]): boolean {
  const t = String(templateId ?? '').toLowerCase();
  return allowed.some((a) => String(a).toLowerCase() === t);
}

/** First translated field to auto-open after drop/append (extensible). */
function firstFocusParameterId(task: unknown): string | null {
  if (isMessageLikeEscalationTask(task as Parameters<typeof isMessageLikeEscalationTask>[0])) {
    return 'text';
  }
  const params = (task as { parameters?: { parameterId?: string }[] })?.parameters;
  if (Array.isArray(params) && params.some((p) => p?.parameterId === 'smsText')) {
    return 'smsText';
  }
  return null;
}

type EscalationTasksListProps = {
  escalation: any;
  escalationIdx: number;
  color: string;
  translations: Record<string, string>;
  allowedActions?: string[];
  updateEscalation: (updater: (esc: any) => any) => void;
  updateSelectedNode: (updater: (node: any) => any, options?: { skipAutoSave?: boolean }) => void;
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
  stepKey,
}: EscalationTasksListProps) {
  const { handleEditingChange, isEditing: isEditingRow } = useTaskEditing();
  const { requestFocusParameter } = useBehaviourUi();
  const {
    translations: contextTranslations,
    addTranslation,
    isReady,
  } = useProjectTranslations();

  const effectiveTranslations = React.useMemo(
    () => ({ ...contextTranslations, ...(translations ?? {}) }),
    [contextTranslations, translations]
  );

  const loggedEmptyWhileReadyRef = React.useRef(false);
  React.useEffect(() => {
    if (!isReady || loggedEmptyWhileReadyRef.current) return;
    if (Object.keys(effectiveTranslations).length > 0) return;
    loggedEmptyWhileReadyRef.current = true;
    if (import.meta.env.DEV) {
      console.warn('[EscalationTasksList] Translations ready but context + props have no entries', {
        escalationIdx,
        stepKey,
      });
    }
  }, [isReady, effectiveTranslations, escalationIdx, stepKey]);

  if (!isReady) {
    return (
      <div className="flex items-center justify-center p-4">
        <span className="text-sm text-gray-500">Loading translations...</span>
      </div>
    );
  }

  const tasks = escalation.tasks ?? [];

  const handleParameterCommit = React.useCallback(
    (taskIdx: number, parameterId: string, newValue: string) => {
      const task = tasks[taskIdx];
      if (!task) return;

      const tKey = resolveTranslationKey(task, parameterId);
      if (tKey) {
        if (addTranslation && typeof addTranslation === 'function') {
          addTranslation(tKey, newValue);
        }
        return;
      }

      updateEscalation((esc) => {
        const next = [...(esc.tasks ?? [])];
        const t = { ...next[taskIdx] };
        t.parameters = (t.parameters ?? []).map((p: { parameterId?: string; value?: unknown }) =>
          p.parameterId === parameterId ? { ...p, value: newValue } : p
        );
        next[taskIdx] = t;
        return { ...esc, tasks: next };
      });
    },
    [tasks, addTranslation, updateEscalation]
  );

  const handleAppend = React.useCallback(
    (task: any) => {
      if (allowedActions && allowedActions.length > 0) {
        const tid = task?.templateId ?? task?.id ?? '';
        if (!matchesAllowedTemplateId(tid, allowedActions)) {
          return;
        }
      }

      let taskRef: ReturnType<typeof normalizeTaskForEscalation>;
      try {
        taskRef = normalizeTaskForEscalation(task);
      } catch (e) {
        console.error('[EscalationTasksList] normalizeTaskForEscalation failed on append', e, { task });
        return;
      }
      updateEscalation((esc) => {
        const newTasks = [...(esc.tasks ?? []), taskRef];
        const newTaskIdx = newTasks.length - 1;
        const pid = firstFocusParameterId(taskRef);
        if (pid) {
          setTimeout(() => {
            requestFocusParameter({
              kind: 'parameter',
              escalationIdx,
              taskIdx: newTaskIdx,
              parameterId: pid,
            });
          }, 0);
        }
        return { ...esc, tasks: newTasks };
      });
    },
    [updateEscalation, escalationIdx, allowedActions, requestFocusParameter]
  );

  const handleDelete = React.useCallback(
    (taskIdx: number) => {
      updateEscalation((esc) => {
        const next = (esc.tasks ?? []).filter((_: unknown, j: number) => j !== taskIdx);
        return { ...esc, tasks: next };
      });
    },
    [updateEscalation]
  );

  const handleDropFromViewer = React.useCallback(
    (
      incoming: any,
      to: { escalationIdx: number; taskIdx: number },
      position: 'before' | 'after'
    ) => {
      if (to.escalationIdx !== escalationIdx) {
        return;
      }

      const task = incoming?.task || incoming;

      const templateId =
        task?.templateId !== undefined ? task.templateId : (task?.id ?? null);

      let taskType: number | null =
        task?.type !== undefined && task?.type !== null ? task.type : null;
      if (taskType === null && templateId != null) {
        const inferred = templateIdToTaskType(String(templateId));
        if (inferred !== TaskType.UNDEFINED) {
          taskType = inferred;
        }
      }
      if (taskType === undefined || taskType === null) {
        console.error('[handleDropFromViewer] Task is missing required field "type"', { incoming, task });
        return;
      }

      const taskToNormalize = {
        ...task,
        type: taskType,
        templateId,
      };

      if (allowedActions && allowedActions.length > 0) {
        if (!matchesAllowedTemplateId(templateId, allowedActions)) {
          return;
        }
      }

      let normalized: ReturnType<typeof normalizeTaskForEscalation>;
      try {
        normalized = normalizeTaskForEscalation(taskToNormalize, generateGuid);
      } catch (e) {
        console.error('[EscalationTasksList] normalizeTaskForEscalation failed on drop', e, { taskToNormalize });
        return;
      }

      const insertIdx = position === 'after' ? to.taskIdx + 1 : to.taskIdx;

      updateEscalation((esc) => {
        const next = [...(esc.tasks ?? [])];
        next.splice(insertIdx, 0, normalized);
        return { ...esc, tasks: next };
      });

      const targetIdx = position === 'after' ? to.taskIdx + 1 : to.taskIdx;
      const pid = firstFocusParameterId(normalized);
      if (pid) {
        setTimeout(() => {
          requestFocusParameter({
            kind: 'parameter',
            escalationIdx,
            taskIdx: targetIdx,
            parameterId: pid,
          });
        }, 0);
      }
    },
    [updateEscalation, escalationIdx, allowedActions, requestFocusParameter]
  );

  const handleMoveTask = React.useCallback(
    (
      fromEscIdx: number,
      fromTaskIdx: number,
      toEscIdx: number,
      toTaskIdx: number,
      position: 'before' | 'after'
    ) => {
      updateSelectedNode((node) => {
        return updateStepEscalations(node, stepKey, (escalations) => {
          const updated = [...escalations];

          const fromEsc = updated[fromEscIdx];
          if (!fromEsc) return escalations;

          const escTasks = [...(fromEsc.tasks ?? [])];
          const moved = escTasks[fromTaskIdx];
          if (!moved) return escalations;

          escTasks.splice(fromTaskIdx, 1);
          updated[fromEscIdx] = { ...fromEsc, tasks: escTasks };

          if (!updated[toEscIdx]) {
            updated[toEscIdx] = { tasks: [] };
          }
          const toTasks = [...(updated[toEscIdx].tasks ?? [])];
          const insertIdx = position === 'after' ? toTaskIdx + 1 : toTaskIdx;
          toTasks.splice(insertIdx, 0, moved);
          updated[toEscIdx] = { ...updated[toEscIdx], tasks: toTasks };

          return updated;
        });
      });
    },
    [updateSelectedNode, stepKey]
  );

  return (
    <CanvasDropWrapper onDropTask={handleAppend} isEmpty={tasks.length === 0}>
      {tasks.length === 0 ? (
        <PanelEmptyDropZone
          color={color}
          onDropTask={handleAppend}
          compact
          idleLabel="Nessuna azione in questa escalation ancora. Apri la scheda Tasks nella barra in alto, poi trascina un task qui (o dal catalogo)."
          overLabel="Rilascia per aggiungere il task"
        />
      ) : (
        tasks.map((task: any, j: number) => {
          const templateId = task.templateId ?? task.id ?? 'sayMessage';
          const isMessageRow = isMessageLikeEscalationTask(task);
          const isEditing = isEditingRow(j);
          const params = Array.isArray(task.parameters) ? task.parameters : [];

          const header = (
            <TaskRowHeader
              icon={
                isMessageRow
                  ? undefined
                  : task.iconName
                    ? getIconComponent(task.iconName, ensureHexColor(task.color))
                    : getTaskIconNode(templateId, ensureHexColor(task.color))
              }
              showMessageIcon={isMessageRow}
              label={isMessageRow ? undefined : task.label ?? getTaskLabel(templateId)}
              color={color}
            />
          );

          const openPrimary = () => {
            if (isMessageRow) {
              requestFocusParameter({
                kind: 'parameter',
                escalationIdx,
                taskIdx: j,
                parameterId: 'text',
              });
            } else {
              const pid = firstFocusParameterId(task);
              if (pid) {
                requestFocusParameter({
                  kind: 'parameter',
                  escalationIdx,
                  taskIdx: j,
                  parameterId: pid,
                });
              }
            }
          };

          const body = (
            <TaskRowBody>
              {params.length === 0 ? (
                <span style={{ color: '#64748b', fontSize: 13 }}>—</span>
              ) : (
                params.map((param: { parameterId: string; value: unknown }) => (
                  <ParameterFieldHost
                    key={param.parameterId}
                    task={task}
                    param={param}
                    translations={effectiveTranslations}
                    escalationIdx={escalationIdx}
                    taskIdx={j}
                    onCommit={(v) => handleParameterCommit(j, param.parameterId, v)}
                    onEditingActivity={(active) => handleEditingChange(j)(active)}
                  />
                ))
              )}
            </TaskRowBody>
          );

          return (
            <TaskRowDnDWrapper
              key={`${escalationIdx}-${j}-${task.id ?? j}`}
              escalationIdx={escalationIdx}
              taskIdx={j}
              task={task}
              onMoveTask={handleMoveTask}
              onDropNewTask={(t, to, pos) => handleDropFromViewer(t, to, pos)}
              allowViewerDrop={true}
              isEditing={isEditing}
            >
              <TaskRow
                header={header}
                body={body}
                color={color}
                draggable
                selected={false}
                onDelete={() => handleDelete(j)}
                onEditPrimary={params.length > 0 ? openPrimary : undefined}
                rowEditorActive={isEditing}
              />
            </TaskRowDnDWrapper>
          );
        })
      )}
    </CanvasDropWrapper>
  );
}
