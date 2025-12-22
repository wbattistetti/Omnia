import React from 'react';
import { info } from '../../../utils/logger';
import { Escalation, Action } from './types';
import { normalizeActionFromViewer } from './utils/normalize';

export type Position = 'before' | 'after';

export default function useActionCommands(
  setLocalModel: React.Dispatch<React.SetStateAction<Escalation[]>>,
  onCommit?: (next: Escalation[]) => void
) {
  const editTask = React.useCallback((escalationIdx: number, taskIdx: number, newText: string) => {
    setLocalModel(prev => {
      // ✅ Support both tasks (new) and actions (legacy)
      const next = prev.map(esc => {
        if (esc.tasks) {
          return { ...esc, tasks: [...esc.tasks] };
        } else {
          return { ...esc, actions: [...(esc.actions || [])] };
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
        targetEsc.actions[taskIdx] = { ...targetEsc.actions[taskIdx], text: newText } as Action;
      }

      try { info('RESPONSE_EDITOR', 'editTask', { escalationIdx, taskIdx, newTextLen: newText?.length || 0 }); } catch { }
      try { onCommit?.(next); } catch { }
      return next;
    });
  }, [setLocalModel, onCommit]);

  const deleteTask = React.useCallback((escalationIdx: number, taskIdx: number) => {
    setLocalModel(prev => {
      // ✅ Support both tasks (new) and actions (legacy)
      const next = prev.map(esc => {
        if (esc.tasks) {
          return { ...esc, tasks: [...esc.tasks] };
        } else {
          return { ...esc, actions: [...(esc.actions || [])] };
        }
      });

      const targetEsc = next[escalationIdx];
      if (targetEsc.tasks) {
        targetEsc.tasks.splice(taskIdx, 1);
      } else {
        targetEsc.actions.splice(taskIdx, 1);
      }

      try { info('RESPONSE_EDITOR', 'deleteTask', { escalationIdx, taskIdx }); } catch { }
      try { onCommit?.(next); } catch { }
      return next;
    });
  }, [setLocalModel, onCommit]);

  const moveTask = React.useCallback((fromEscIdx: number, fromTaskIdx: number, toEscIdx: number, toTaskIdx: number, position: Position) => {
    setLocalModel(prev => {
      // ✅ Support both tasks (new) and actions (legacy)
      const next = prev.map(esc => {
        if (esc.tasks) {
          return { ...esc, tasks: [...esc.tasks] };
        } else {
          return { ...esc, actions: [...(esc.actions || [])] };
        }
      });

      const fromEsc = next[fromEscIdx];
      const toEsc = next[toEscIdx];

      let item: any;
      if (fromEsc.tasks) {
        item = fromEsc.tasks[fromTaskIdx];
        fromEsc.tasks.splice(fromTaskIdx, 1);
      } else {
        item = fromEsc.actions[fromTaskIdx];
        fromEsc.actions.splice(fromTaskIdx, 1);
      }

      let insertIdx = toTaskIdx;
      if (fromEscIdx === toEscIdx && fromTaskIdx < toTaskIdx) insertIdx--;
      if (position === 'after') insertIdx++;

      if (toEsc.tasks) {
        toEsc.tasks.splice(insertIdx, 0, item);
      } else {
        toEsc.actions = toEsc.actions || [];
        toEsc.actions.splice(insertIdx, 0, item);
      }

      try { info('RESPONSE_EDITOR', 'moveTask', { fromEscIdx, fromTaskIdx, toEscIdx, toTaskIdx, position }); } catch { }
      try { onCommit?.(next); } catch { }
      return next;
    });
  }, [setLocalModel, onCommit]);

  const dropTaskFromViewer = React.useCallback((incoming: any, to: { escalationIdx: number; taskIdx: number }, position: Position) => {
    console.log('[useActionCommands][dropTaskFromViewer] 🔍 Drop started', {
      incoming,
      to,
      position,
      incomingKeys: incoming ? Object.keys(incoming) : null,
      incomingAction: incoming?.action,
      incomingId: incoming?.id,
      incomingActionId: incoming?.actionId
    });

    setLocalModel(prev => {
      console.log('[useActionCommands][dropTaskFromViewer] 🔍 Current model state', {
        prevLength: prev.length,
        targetEscIdx: to.escalationIdx,
        targetEsc: prev[to.escalationIdx] ? {
          hasActions: !!prev[to.escalationIdx].actions,
          actionsCount: prev[to.escalationIdx].actions?.length || 0,
          hasTasks: !!prev[to.escalationIdx].tasks,
          tasksCount: prev[to.escalationIdx].tasks?.length || 0,
          keys: Object.keys(prev[to.escalationIdx])
        } : null
      });

      // ✅ Support both tasks (new) and actions (legacy)
      const next = prev.map(esc => {
        // Preserve tasks if they exist, otherwise use actions
        if (esc.tasks) {
          return { ...esc, tasks: [...esc.tasks] };
        } else {
          return { ...esc, actions: [...(esc.actions || [])] };
        }
      });

      const newAction = normalizeActionFromViewer(incoming);
      console.log('[useActionCommands][dropTaskFromViewer] 🔍 Normalized action', {
        newAction,
        actionId: newAction.actionId,
        hasText: !!newAction.text,
        hasTextKey: !!newAction.textKey
      });

      let insertIdx = to.taskIdx;
      if (position === 'after') insertIdx++;

      // ✅ Add to tasks if escalation has tasks, otherwise to actions
      const targetEsc = next[to.escalationIdx];
      if (targetEsc.tasks) {
        // ✅ Convert Action to TaskReference format
        const newTask = {
          templateId: newAction.actionId,
          taskId: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // Generate new GUID
          parameters: newAction.textKey ? [{ parameterId: 'text', value: newAction.textKey }] : []
        };
        targetEsc.tasks.splice(insertIdx, 0, newTask);
        console.log('[useActionCommands][dropTaskFromViewer] ✅ Added to tasks', {
          escalationIdx: to.escalationIdx,
          insertIdx,
          newTask,
          tasksCount: targetEsc.tasks.length
        });
      } else {
        targetEsc.actions = targetEsc.actions || [];
        targetEsc.actions.splice(insertIdx, 0, newAction);
        console.log('[useActionCommands][dropTaskFromViewer] ✅ Added to actions', {
          escalationIdx: to.escalationIdx,
          insertIdx,
          newAction,
          actionsCount: targetEsc.actions.length
        });
      }

      try { info('RESPONSE_EDITOR', 'dropTaskFromViewer', { to, position, insertIdx, actionId: (newAction as any)?.actionId }); } catch { }
      try { onCommit?.(next); } catch { }
      return next;
    });
  }, [setLocalModel, onCommit]);

  const appendTask = React.useCallback((escalationIdx: number, action: Action) => {
    console.log('[useActionCommands][appendTask] 🔍 Append started', {
      escalationIdx,
      action,
      actionId: action.actionId
    });

    setLocalModel(prev => {
      // ✅ Support both tasks (new) and actions (legacy)
      const next = prev.map(esc => {
        if (esc.tasks) {
          return { ...esc, tasks: [...esc.tasks] };
        } else {
          return { ...esc, actions: [...(esc.actions || [])] };
        }
      });

      if (!next[escalationIdx]) {
        // crea escalation mancante
        while (next.length <= escalationIdx) next.push({ actions: [] });
      }

      const targetEsc = next[escalationIdx];
      if (targetEsc.tasks) {
        // ✅ Convert Action to TaskReference format
        const newTask = {
          templateId: action.actionId,
          taskId: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // Generate new GUID
          parameters: action.textKey ? [{ parameterId: 'text', value: action.textKey }] : []
        };
        targetEsc.tasks.push(newTask);
        console.log('[useActionCommands][appendTask] ✅ Added to tasks', {
          escalationIdx,
          newTask,
          tasksCount: targetEsc.tasks.length
        });
      } else {
        targetEsc.actions = targetEsc.actions || [];
        targetEsc.actions.push(action);
        console.log('[useActionCommands][appendTask] ✅ Added to actions', {
          escalationIdx,
          action,
          actionsCount: targetEsc.actions.length
        });
      }

      try { info('RESPONSE_EDITOR', 'appendTask', { escalationIdx, actionId: (action as any)?.actionId }); } catch { }
      try { onCommit?.(next); } catch { }
      return next;
    });
  }, [setLocalModel, onCommit]);

  return { editTask, deleteTask, moveTask, dropTaskFromViewer, appendTask };
}
