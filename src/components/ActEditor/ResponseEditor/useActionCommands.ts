import React from 'react';
import { info } from '../../../utils/logger';
import { Escalation, TaskReference } from './types';
import { normalizeTaskFromViewer } from './utils/normalize';

export type Position = 'before' | 'after';

export default function useActionCommands(
  setLocalModel: React.Dispatch<React.SetStateAction<Escalation[]>>,
  onCommit?: (next: Escalation[]) => void
) {
  // ⚠️ IMPORTANTE: Usa un ref per onCommit per evitare che i callback vengano ricreati
  // quando onCommit cambia. Questo previene chiamate multiple al drop handler.
  const onCommitRef = React.useRef(onCommit);
  React.useEffect(() => {
    onCommitRef.current = onCommit;
  }, [onCommit]);

  const editTask = React.useCallback((escalationIdx: number, taskIdx: number, newText: string) => {
    const trimmedText = (newText || '').trim();

    // If text is empty, delete the task instead of editing it
    if (trimmedText.length === 0) {
      setLocalModel(prev => {
        const next = prev.map(esc => ({
          ...esc,
          tasks: [...(esc.tasks || [])]
        }));

        const targetEsc = next[escalationIdx];
        if (targetEsc && targetEsc.tasks) {
          targetEsc.tasks.splice(taskIdx, 1);

          // If escalation becomes empty, remove it
          if (targetEsc.tasks.length === 0) {
            next.splice(escalationIdx, 1);
          }
        }

        try { info('RESPONSE_EDITOR', 'editTask (empty -> delete)', { escalationIdx, taskIdx }); } catch { }
        try { onCommitRef.current?.(next); } catch { }
        return next;
      });
      return;
    }

    setLocalModel(prev => {
      // ✅ Always use tasks
      const next = prev.map(esc => ({
        ...esc,
        tasks: [...(esc.tasks || [])]
      }));

      const targetEsc = next[escalationIdx];
      // ✅ Update task text parameter
      const task = targetEsc.tasks[taskIdx];
      if (task) {
        const textParam = task.parameters?.find((p: any) => p.parameterId === 'text');
        if (textParam) {
          textParam.value = trimmedText;
        } else {
          task.parameters = [...(task.parameters || []), { parameterId: 'text', value: trimmedText }];
        }
      }

      try { info('RESPONSE_EDITOR', 'editTask', { escalationIdx, taskIdx, newTextLen: trimmedText.length }); } catch { }
      try { onCommitRef.current?.(next); } catch { }
      return next;
    });
  }, [setLocalModel]);

  const deleteTask = React.useCallback((escalationIdx: number, taskIdx: number) => {
    setLocalModel(prev => {
      // ✅ Always use tasks
      const next = prev.map(esc => ({
        ...esc,
        tasks: [...(esc.tasks || [])]
      }));

      const targetEsc = next[escalationIdx];
      if (targetEsc && targetEsc.tasks) {
        targetEsc.tasks.splice(taskIdx, 1);

        // If escalation becomes empty, remove it
        if (targetEsc.tasks.length === 0) {
          next.splice(escalationIdx, 1);
        }
      }

      try { info('RESPONSE_EDITOR', 'deleteTask', { escalationIdx, taskIdx }); } catch { }
      try { onCommitRef.current?.(next); } catch { }
      return next;
    });
  }, [setLocalModel]);

  const moveTask = React.useCallback((fromEscIdx: number, fromTaskIdx: number, toEscIdx: number, toTaskIdx: number, position: Position) => {
    setLocalModel(prev => {
      // ✅ Always use tasks
      const next = prev.map(esc => ({
        ...esc,
        tasks: [...(esc.tasks || [])]
      }));

      const fromEsc = next[fromEscIdx];
      const toEsc = next[toEscIdx];

      const item = fromEsc.tasks[fromTaskIdx];
      fromEsc.tasks.splice(fromTaskIdx, 1);

      let insertIdx = toTaskIdx;
      if (fromEscIdx === toEscIdx && fromTaskIdx < toTaskIdx) insertIdx--;
      if (position === 'after') insertIdx++;

      toEsc.tasks.splice(insertIdx, 0, item);

      try { info('RESPONSE_EDITOR', 'moveTask', { fromEscIdx, fromTaskIdx, toEscIdx, toTaskIdx, position }); } catch { }
      try { onCommitRef.current?.(next); } catch { }
      return next;
    });
  }, [setLocalModel]);

  // Ref per tracciare se un drop è già in corso (per prevenire esecuzioni multiple della funzione updater)
  // Usa un Set per tracciare le chiavi dei drop in corso
  const dropInProgressRef = React.useRef<Set<string>>(new Set());

  const dropTaskFromViewer = React.useCallback((incoming: any, to: { escalationIdx: number; taskIdx: number }, position: Position) => {
    // Crea una chiave unica per questo drop (senza timestamp per raggruppare chiamate duplicate)
    const dropKey = `${to.escalationIdx}-${to.taskIdx}-${position}-${incoming?.templateId || incoming?.actionId || incoming?.id || 'unknown'}`;

    // Assicurati che il Set esista
    if (!dropInProgressRef.current) {
      dropInProgressRef.current = new Set();
    }

    // Se c'è già un drop in corso con la stessa chiave, ignora questa chiamata
    if (dropInProgressRef.current.has(dropKey)) {
      return;
    }

    // Marca questo drop come in corso
    dropInProgressRef.current.add(dropKey);

    // Pulisci il flag dopo un breve delay
    setTimeout(() => {
      dropInProgressRef.current.delete(dropKey);
    }, 200);

    setLocalModel(prev => {
      // Guard dentro la funzione updater per prevenire esecuzioni multiple
      // Assicurati che il Set esista
      if (!dropInProgressRef.current) {
        dropInProgressRef.current = new Set();
      }

      // Usa delete per rimuovere la chiave in modo atomico: ritorna true solo se la chiave esisteva
      const wasInSet = dropInProgressRef.current.delete(dropKey);

      if (!wasInSet) {
        // La chiave non era nel Set, significa che questa esecuzione è già stata processata
        return prev; // Return previous state unchanged
      }

      // ✅ Always use tasks
      const next = prev.map(esc => ({
        ...esc,
        tasks: [...(esc.tasks || [])]
      }));

      const normalized = normalizeTaskFromViewer(incoming);

      let insertIdx = to.taskIdx;
      if (position === 'after') insertIdx++;

      // ✅ Always use tasks
      const targetEsc = next[to.escalationIdx];
      if (!targetEsc.tasks) {
        targetEsc.tasks = [];
      }

      targetEsc.tasks.splice(insertIdx, 0, normalized);

      try { info('RESPONSE_EDITOR', 'dropTaskFromViewer', { to, position, insertIdx }); } catch { }
      try { onCommitRef.current?.(next); } catch { }
      return next;
    });
  }, [setLocalModel]);

  const appendTask = React.useCallback((escalationIdx: number, task: TaskReference | any) => {

    setLocalModel(prev => {
      // ✅ Always use tasks
      const next = prev.map(esc => ({
        ...esc,
        tasks: [...(esc.tasks || [])]
      }));

      if (!next[escalationIdx]) {
        // crea escalation mancante
        while (next.length <= escalationIdx) next.push({ tasks: [] });
      }

      const targetEsc = next[escalationIdx];
      if (!targetEsc.tasks) {
        targetEsc.tasks = [];
      }

      // ✅ Ensure task has required fields
      const newTask: TaskReference = {
        templateId: task.templateId || task.actionId || 'sayMessage',
        taskId: task.taskId || `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        parameters: task.parameters || (task.textKey ? [{ parameterId: 'text', value: task.textKey }] : []),
        text: task.text,
        color: task.color,
        label: task.label
      };

      targetEsc.tasks.push(newTask);

      try { info('RESPONSE_EDITOR', 'appendTask', { escalationIdx, templateId: newTask.templateId }); } catch { }
      try { onCommitRef.current?.(next); } catch { }
      return next;
    });
  }, [setLocalModel]);

  return { editTask, deleteTask, moveTask, dropTaskFromViewer, appendTask };
}
