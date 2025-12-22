import React from 'react';
import { info } from '../../../utils/logger';
import { Escalation, TaskReference } from './types';
import { normalizeTaskFromViewer } from './utils/normalize';

export type Position = 'before' | 'after';

export default function useActionCommands(
  setLocalModel: React.Dispatch<React.SetStateAction<Escalation[]>>,
  onCommit?: (next: Escalation[]) => void
) {
  const editTask = React.useCallback((escalationIdx: number, taskIdx: number, newText: string) => {
    setLocalModel(prev => {
      // ✅ Always use tasks (migrate legacy actions if needed)
      const next = prev.map(esc => {
        if (esc.tasks) {
          return { ...esc, tasks: [...esc.tasks] };
        } else if (esc.actions) {
          // Migrate legacy actions to tasks
          const migratedTasks = esc.actions.map((oldAction: any) => ({
            templateId: oldAction.actionId || oldAction.templateId || 'sayMessage',
            taskId: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            parameters: oldAction.textKey ? [{ parameterId: 'text', value: oldAction.textKey }] : [],
            text: oldAction.text,
            color: oldAction.color
          }));
          return { ...esc, tasks: migratedTasks };
        } else {
          return { ...esc, tasks: [] };
        }
      });

      const targetEsc = next[escalationIdx];
      if (targetEsc.tasks) {
        // ✅ Update task text parameter
        const task = targetEsc.tasks[taskIdx];
        if (task) {
          const textParam = task.parameters?.find((p: any) => p.parameterId === 'text');
          if (textParam) {
            textParam.value = newText;
          } else {
            task.parameters = [...(task.parameters || []), { parameterId: 'text', value: newText }];
          }
        }
      } else {
        // Legacy support: convert to tasks if actions exist
        if (targetEsc.actions && targetEsc.actions[taskIdx]) {
          const oldAction = targetEsc.actions[taskIdx];
          targetEsc.tasks = targetEsc.tasks || [];
          targetEsc.tasks[taskIdx] = {
            templateId: oldAction.actionId || oldAction.templateId || 'sayMessage',
            taskId: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            parameters: oldAction.textKey ? [{ parameterId: 'text', value: newText }] : [],
            text: newText,
            color: oldAction.color
          };
          delete targetEsc.actions;
        }
      }

      try { info('RESPONSE_EDITOR', 'editTask', { escalationIdx, taskIdx, newTextLen: newText?.length || 0 }); } catch { }
      try { onCommit?.(next); } catch { }
      return next;
    });
  }, [setLocalModel, onCommit]);

  const deleteTask = React.useCallback((escalationIdx: number, taskIdx: number) => {
    setLocalModel(prev => {
      // ✅ Always use tasks (migrate legacy actions if needed)
      const next = prev.map(esc => {
        if (esc.tasks) {
          return { ...esc, tasks: [...esc.tasks] };
        } else if (esc.actions) {
          // Migrate legacy actions to tasks
          const migratedTasks = esc.actions.map((oldAction: any) => ({
            templateId: oldAction.actionId || oldAction.templateId || 'sayMessage',
            taskId: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            parameters: oldAction.textKey ? [{ parameterId: 'text', value: oldAction.textKey }] : [],
            text: oldAction.text,
            color: oldAction.color
          }));
          return { ...esc, tasks: migratedTasks };
        } else {
          return { ...esc, tasks: [] };
        }
      });

      const targetEsc = next[escalationIdx];
      if (targetEsc.tasks) {
        targetEsc.tasks.splice(taskIdx, 1);
      } else if (targetEsc.actions) {
        // Legacy support: convert to tasks
        targetEsc.tasks = targetEsc.tasks || [];
        targetEsc.actions.splice(taskIdx, 1);
        if (targetEsc.actions.length === 0) {
          delete targetEsc.actions;
        }
      }

      try { info('RESPONSE_EDITOR', 'deleteTask', { escalationIdx, taskIdx }); } catch { }
      try { onCommit?.(next); } catch { }
      return next;
    });
  }, [setLocalModel, onCommit]);

  const moveTask = React.useCallback((fromEscIdx: number, fromTaskIdx: number, toEscIdx: number, toTaskIdx: number, position: Position) => {
    setLocalModel(prev => {
      // ✅ Always use tasks (migrate legacy actions if needed)
      const next = prev.map(esc => {
        if (esc.tasks) {
          return { ...esc, tasks: [...esc.tasks] };
        } else if (esc.actions) {
          // Migrate legacy actions to tasks
          const migratedTasks = esc.actions.map((oldAction: any) => ({
            templateId: oldAction.actionId || oldAction.templateId || 'sayMessage',
            taskId: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            parameters: oldAction.textKey ? [{ parameterId: 'text', value: oldAction.textKey }] : [],
            text: oldAction.text,
            color: oldAction.color
          }));
          return { ...esc, tasks: migratedTasks };
        } else {
          return { ...esc, tasks: [] };
        }
      });

      const fromEsc = next[fromEscIdx];
      const toEsc = next[toEscIdx];

      let item: any;
      if (fromEsc.tasks) {
        item = fromEsc.tasks[fromTaskIdx];
        fromEsc.tasks.splice(fromTaskIdx, 1);
      } else if (fromEsc.actions) {
        // Legacy support: convert action to task
        const oldAction = fromEsc.actions[fromTaskIdx];
        item = {
          templateId: oldAction.actionId || oldAction.templateId || 'sayMessage',
          taskId: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          parameters: oldAction.textKey ? [{ parameterId: 'text', value: oldAction.textKey }] : [],
          text: oldAction.text,
          color: oldAction.color
        };
        fromEsc.actions.splice(fromTaskIdx, 1);
        if (fromEsc.actions.length === 0) {
          delete fromEsc.actions;
        }
      }

      let insertIdx = toTaskIdx;
      if (fromEscIdx === toEscIdx && fromTaskIdx < toTaskIdx) insertIdx--;
      if (position === 'after') insertIdx++;

      if (toEsc.tasks) {
        toEsc.tasks.splice(insertIdx, 0, item);
      } else {
        // Legacy support: convert to tasks
        toEsc.tasks = toEsc.tasks || [];
        if (toEsc.actions) {
          // Migrate existing actions to tasks
          toEsc.actions.forEach((oldAction: any) => {
            toEsc.tasks!.push({
              templateId: oldAction.actionId || oldAction.templateId || 'sayMessage',
              taskId: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              parameters: oldAction.textKey ? [{ parameterId: 'text', value: oldAction.textKey }] : [],
              text: oldAction.text,
              color: oldAction.color
            });
          });
          delete toEsc.actions;
        }
        toEsc.tasks.splice(insertIdx, 0, item);
      }

      try { info('RESPONSE_EDITOR', 'moveTask', { fromEscIdx, fromTaskIdx, toEscIdx, toTaskIdx, position }); } catch { }
      try { onCommit?.(next); } catch { }
      return next;
    });
  }, [setLocalModel, onCommit]);

  const dropTaskFromViewer = React.useCallback((incoming: any, to: { escalationIdx: number; taskIdx: number }, position: Position) => {
    setLocalModel(prev => {

      // ✅ Support both tasks (new) and actions (legacy)
      const next = prev.map(esc => {
        // Preserve tasks if they exist, otherwise use actions
        if (esc.tasks) {
          return { ...esc, tasks: [...esc.tasks] };
        } else {
          return { ...esc, actions: [...(esc.actions || [])] };
        }
      });

      const normalized = normalizeTaskFromViewer(incoming);

      let insertIdx = to.taskIdx;
      if (position === 'after') insertIdx++;

      // ✅ Always use tasks (convert legacy actions if needed)
      const targetEsc = next[to.escalationIdx];
      if (!targetEsc.tasks) {
        // Migrate legacy actions to tasks
        targetEsc.tasks = [];
        if (targetEsc.actions) {
          targetEsc.actions.forEach((oldAction: any) => {
            targetEsc.tasks!.push({
              templateId: oldAction.actionId || oldAction.templateId || 'sayMessage',
              taskId: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              parameters: oldAction.textKey ? [{ parameterId: 'text', value: oldAction.textKey }] : [],
              text: oldAction.text,
              color: oldAction.color
            });
          });
          delete targetEsc.actions;
        }
      }

      targetEsc.tasks.splice(insertIdx, 0, normalized);

      try { info('RESPONSE_EDITOR', 'dropTaskFromViewer', { to, position, insertIdx, actionId: (newAction as any)?.actionId }); } catch { }
      try { onCommit?.(next); } catch { }
      return next;
    });
  }, [setLocalModel, onCommit]);

  const appendTask = React.useCallback((escalationIdx: number, task: TaskReference | any) => {

    setLocalModel(prev => {
      // ✅ Always use tasks (migrate legacy actions if needed)
      const next = prev.map(esc => {
        if (esc.tasks) {
          return { ...esc, tasks: [...esc.tasks] };
        } else if (esc.actions) {
          // Migrate legacy actions to tasks
          const migratedTasks = esc.actions.map((oldAction: any) => ({
            templateId: oldAction.actionId || oldAction.templateId || 'sayMessage',
            taskId: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            parameters: oldAction.textKey ? [{ parameterId: 'text', value: oldAction.textKey }] : [],
            text: oldAction.text,
            color: oldAction.color
          }));
          return { ...esc, tasks: migratedTasks };
        } else {
          return { ...esc, tasks: [] };
        }
      });

      if (!next[escalationIdx]) {
        // crea escalation mancante
        while (next.length <= escalationIdx) next.push({ tasks: [] });
      }

      const targetEsc = next[escalationIdx];
      if (!targetEsc.tasks) {
        targetEsc.tasks = [];
        // Migrate legacy actions if they exist
        if (targetEsc.actions) {
          targetEsc.actions.forEach((oldAction: any) => {
            targetEsc.tasks!.push({
              templateId: oldAction.actionId || oldAction.templateId || 'sayMessage',
              taskId: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              parameters: oldAction.textKey ? [{ parameterId: 'text', value: oldAction.textKey }] : [],
              text: oldAction.text,
              color: oldAction.color
            });
          });
          delete targetEsc.actions;
        }
      }

      // ✅ Ensure task has required fields
      const newTask: TaskReference = {
        templateId: task.templateId || task.actionId || 'sayMessage',
        taskId: task.taskId || `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        parameters: task.parameters || (task.textKey ? [{ parameterId: 'text', value: task.textKey }] : []),
        text: task.text,
        color: task.color
      };

      targetEsc.tasks.push(newTask);

      try { info('RESPONSE_EDITOR', 'appendTask', { escalationIdx, templateId: newTask.templateId }); } catch { }
      try { onCommit?.(next); } catch { }
      return next;
    });
  }, [setLocalModel, onCommit]);

  return { editTask, deleteTask, moveTask, dropTaskFromViewer, appendTask };
}
