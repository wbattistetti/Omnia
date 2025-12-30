import React from 'react';
import { info } from '../../../utils/logger';
import type { Task } from '../../../types/taskTypes';
import { TaskType, templateIdToTaskType } from '../../../types/taskTypes';
import { createTask } from './utils/normalize';

export type Position = 'before' | 'after';

// ✅ Helper per ottenere le escalations dal node (gestisce entrambi i formati)
function getEscalations(node: any, stepKey: string): any[] {
  if (!node?.steps) return [];

  // Case A: steps as object { start: { escalations: [...] } }
  if (!Array.isArray(node.steps) && node.steps[stepKey]) {
    return node.steps[stepKey].escalations || [];
  }

  // Case B: steps as array [{ type: 'start', escalations: [...] }, ...]
  if (Array.isArray(node.steps)) {
    const step = node.steps.find((s: any) => s?.type === stepKey);
    return step?.escalations || [];
  }

  return [];
}

// ✅ Helper per ottenere i tasks da un'escalation
function getTasks(esc: any): any[] {
  return esc?.tasks || [];
}

// ✅ Helper per generare un GUID valido
function generateGuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export default function useTaskCommands(
  node: any, // ✅ Node DDT diretto
  stepKey: string, // ✅ Step key
  onUpdateNode: (updater: (node: any) => any) => void // ✅ Callback per aggiornare il node
) {
  // ⚠️ IMPORTANTE: Usa un ref per onUpdateNode per evitare che i callback vengano ricreati
  const onUpdateRef = React.useRef(onUpdateNode);
  React.useEffect(() => {
    onUpdateRef.current = onUpdateNode;
  }, [onUpdateNode]);

  // ✅ Ref per tracciare i taskId inseriti nel batch corrente (per idempotenza)
  // Questo previene inserimenti duplicati quando dropTaskFromViewer viene chiamato due volte
  const pendingTaskIdsRef = React.useRef<Set<string>>(new Set());


  const editTask = React.useCallback((escalationIdx: number, taskIdx: number, newText: string) => {
    const trimmedText = (newText || '').trim();

    onUpdateRef.current((node) => {
      let escalations = getEscalations(node, stepKey);

      // ✅ Create a deep copy of escalations to avoid mutations
      escalations = escalations.map(esc => ({
        ...esc,
        tasks: [...(esc.tasks || [])]
      }));

      if (escalationIdx >= escalations.length) return node;

      const esc = escalations[escalationIdx];
      const tasks = getTasks(esc);
      if (taskIdx >= tasks.length) return node;

      // If text is empty, delete the task instead of editing it
      if (trimmedText.length === 0) {
        tasks.splice(taskIdx, 1);

        // If escalation becomes empty, remove it
        if (tasks.length === 0) {
          escalations.splice(escalationIdx, 1);
        }

        // Update node structure
        const next = { ...node };
        if (Array.isArray(next.steps)) {
          const stepIdx = next.steps.findIndex((s: any) => s?.type === stepKey);
          if (stepIdx >= 0) {
            next.steps = [...next.steps];
            next.steps[stepIdx] = { ...next.steps[stepIdx], escalations: [...escalations] };
          }
        } else {
          next.steps = { ...(next.steps || {}) };
          next.steps[stepKey] = { ...(next.steps[stepKey] || {}), escalations: [...escalations] };
        }

        try { info('RESPONSE_EDITOR', 'editTask (empty -> delete)', { escalationIdx, taskIdx }); } catch { }
        return next;
      }

      // ✅ Update task text parameter
      const task = tasks[taskIdx];
      if (task) {
        const textParam = task.parameters?.find((p: any) => p.parameterId === 'text');
        if (textParam) {
          textParam.value = trimmedText;
        } else {
          task.parameters = [...(task.parameters || []), { parameterId: 'text', value: trimmedText }];
        }
      }

      esc.tasks = [...tasks];

      // Update node structure
      const next = { ...node };
      if (Array.isArray(next.steps)) {
        const stepIdx = next.steps.findIndex((s: any) => s?.type === stepKey);
        if (stepIdx >= 0) {
          next.steps = [...next.steps];
          next.steps[stepIdx] = { ...next.steps[stepIdx], escalations: [...escalations] };
        }
      } else {
        next.steps = { ...(next.steps || {}) };
        next.steps[stepKey] = { ...(next.steps[stepKey] || {}), escalations: [...escalations] };
      }

      try { info('RESPONSE_EDITOR', 'editTask', { escalationIdx, taskIdx, newTextLen: trimmedText.length }); } catch { }
      return next;
    });
  }, [node, stepKey]);

  const deleteTask = React.useCallback((escalationIdx: number, taskIdx: number) => {
    onUpdateRef.current((node) => {
      let escalations = getEscalations(node, stepKey);

      // ✅ Create a deep copy of escalations to avoid mutations
      escalations = escalations.map(esc => ({
        ...esc,
        tasks: [...(esc.tasks || [])]
      }));

      if (escalationIdx >= escalations.length) return node;

      const esc = escalations[escalationIdx];
      const tasks = getTasks(esc);
      if (taskIdx >= tasks.length) return node;

      tasks.splice(taskIdx, 1);

      esc.tasks = [...tasks];

      // If escalation becomes empty, remove it
      if (tasks.length === 0) {
        escalations.splice(escalationIdx, 1);
      }

      // Update node structure
      const next = { ...node };
      if (Array.isArray(next.steps)) {
        const stepIdx = next.steps.findIndex((s: any) => s?.type === stepKey);
        if (stepIdx >= 0) {
          next.steps = [...next.steps];
          next.steps[stepIdx] = { ...next.steps[stepIdx], escalations: [...escalations] };
        }
      } else {
        next.steps = { ...(next.steps || {}) };
        next.steps[stepKey] = { ...(next.steps[stepKey] || {}), escalations: [...escalations] };
      }

      try { info('RESPONSE_EDITOR', 'deleteTask', { escalationIdx, taskIdx }); } catch { }
      return next;
    });
  }, [node, stepKey]);

  const moveTask = React.useCallback((fromEscIdx: number, fromTaskIdx: number, toEscIdx: number, toTaskIdx: number, position: Position) => {
    onUpdateRef.current((node) => {
      let escalations = getEscalations(node, stepKey);

      // ✅ Create a deep copy of escalations to avoid mutations
      escalations = escalations.map(esc => ({
        ...esc,
        tasks: [...(esc.tasks || [])]
      }));

      if (fromEscIdx >= escalations.length || toEscIdx >= escalations.length) return node;

      const fromEsc = escalations[fromEscIdx];
      const toEsc = escalations[toEscIdx];
      const fromTasks = getTasks(fromEsc);
      const toTasks = getTasks(toEsc);

      if (fromTaskIdx >= fromTasks.length) return node;

      const item = fromTasks[fromTaskIdx];
      fromTasks.splice(fromTaskIdx, 1);

      let insertIdx = toTaskIdx;
      if (fromEscIdx === toEscIdx && fromTaskIdx < toTaskIdx) insertIdx--;
      if (position === 'after') insertIdx++;

      toTasks.splice(insertIdx, 0, item);

      fromEsc.tasks = [...fromTasks];
      toEsc.tasks = [...toTasks];

      // Update node structure
      const next = { ...node };
      if (Array.isArray(next.steps)) {
        const stepIdx = next.steps.findIndex((s: any) => s?.type === stepKey);
        if (stepIdx >= 0) {
          next.steps = [...next.steps];
          next.steps[stepIdx] = { ...next.steps[stepIdx], escalations: [...escalations] };
        }
      } else {
        next.steps = { ...(next.steps || {}) };
        next.steps[stepKey] = { ...(next.steps[stepKey] || {}), escalations: [...escalations] };
      }

      try { info('RESPONSE_EDITOR', 'moveTask', { fromEscIdx, fromTaskIdx, toEscIdx, toTaskIdx, position }); } catch { }
      return next;
    });
  }, [node, stepKey]);

  const dropTaskFromViewer = React.useCallback((incoming: any, to: { escalationIdx: number; taskIdx: number }, position: Position) => {
    onUpdateRef.current((node) => {
      let escalations = getEscalations(node, stepKey);

      // ✅ Create a deep copy of escalations to avoid mutations
      escalations = escalations.map(esc => ({
        ...esc,
        tasks: [...(esc.tasks || [])]
      }));

      if (to.escalationIdx >= escalations.length) {
        // Create missing escalations
        while (escalations.length <= to.escalationIdx) {
          escalations.push({ tasks: [] });
        }
      }

      const normalized = createTask(incoming);
      const targetEsc = escalations[to.escalationIdx];
      const tasks = getTasks(targetEsc);

      // Ensure tasks array exists
      if (!targetEsc.tasks) {
        targetEsc.tasks = [];
      }

      // ✅ IDEMPOTENCY CHECK: Check both in the node AND in pending inserts
      // This prevents duplicate inserts when dropTaskFromViewer is called twice with the same id
      if (!normalized.id) {
        console.warn('[useTaskCommands] Normalized task missing id, skipping');
        return node;
      }
      const normalizedId = normalized.id;
      const existingTask = tasks.find((t: any) => t.id === normalizedId);
      const isPending = pendingTaskIdsRef.current.has(normalizedId);

      if (existingTask || isPending) {
        // Task already exists or is being inserted, this is a duplicate drop - ignore it
        return node;
      }

      // ✅ Mark this taskId as pending before inserting
      if (!normalized.id) {
        console.warn('[useTaskCommands] Normalized task missing id, cannot track pending');
        return node;
      }
      const normalizedId = normalized.id;
      pendingTaskIdsRef.current.add(normalizedId);

      // ✅ For sayMessage tasks, ALWAYS generate a new GUID (don't reuse from catalog)
      // In unified model, text is stored directly in task.text, but we also support params for backward compatibility
      if (normalized.templateId === null && !normalized.text) {
        // If it's a standalone sayMessage task without text, generate one
        const textKey = generateGuid();
        // Store in params for backward compatibility
        if (!normalized.params) normalized.params = {};
        normalized.params.text = textKey;
      }

      let insertIdx = to.taskIdx;
      if (position === 'after') insertIdx++;

      tasks.splice(insertIdx, 0, normalized);
      targetEsc.tasks = [...tasks];

      // Update node structure
      const next = { ...node };
      if (Array.isArray(next.steps)) {
        const stepIdx = next.steps.findIndex((s: any) => s?.type === stepKey);
        if (stepIdx >= 0) {
          next.steps = [...next.steps];
          next.steps[stepIdx] = { ...next.steps[stepIdx], escalations: [...escalations] };
        } else {
          // Create step if it doesn't exist
          next.steps = [...(next.steps || []), { type: stepKey, escalations: [...escalations] }];
        }
      } else {
        next.steps = { ...(next.steps || {}) };
        next.steps[stepKey] = { ...(next.steps[stepKey] || {}), escalations: [...escalations], type: stepKey };
      }

      try { info('RESPONSE_EDITOR', 'dropTaskFromViewer', { to, position, insertIdx }); } catch { }

      // ✅ Clear pending id after a short delay (after React has processed the update)
      setTimeout(() => {
        if (normalized.id) {
          pendingTaskIdsRef.current.delete(normalized.id);
        }
      }, 500);

      return next;
    });
  }, [node, stepKey]);

  const appendTask = React.useCallback((escalationIdx: number, task: TaskReference | any) => {
    onUpdateRef.current((node) => {
      let escalations = getEscalations(node, stepKey);

      // ✅ Create a deep copy of escalations to avoid mutations
      escalations = escalations.map(esc => ({
        ...esc,
        tasks: [...(esc.tasks || [])]
      }));

      // Create missing escalations
      if (escalationIdx >= escalations.length) {
        while (escalations.length <= escalationIdx) {
          escalations.push({ tasks: [] });
        }
      }

      const targetEsc = escalations[escalationIdx];
      const tasks = getTasks(targetEsc);

      // Ensure tasks array exists
      if (!targetEsc.tasks) {
        targetEsc.tasks = [];
      }

      // ✅ Ensure task has required fields
      const templateId = task.templateId || 'sayMessage';
      let parameters = task.parameters || (task.textKey ? [{ parameterId: 'text', value: task.textKey }] : []);

      // ✅ For sayMessage tasks without textKey, generate a GUID
      if (templateId === 'sayMessage' && !parameters.find((p: any) => p.parameterId === 'text')?.value) {
        const textKey = generateGuid();
        parameters = [{ parameterId: 'text', value: textKey }];
      }

      if (!task.id) {
        console.warn('[useTaskCommands] Task missing id, generating new one');
      }
      const taskId = task.id || `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // ✅ Determina TaskType dal templateId
      const taskType = task.type ?? templateIdToTaskType(templateId) || TaskType.SayMessage;

      const newTask: any = {
        id: taskId,
        type: taskType, // ✅ Aggiunto campo type (enum numerico)
        templateId: templateId,
        // Store parameters in params for backward compatibility
        params: parameters ? { text: parameters.find((p: any) => p.parameterId === 'text')?.value } : {},
        text: task.text,
        color: task.color,
        label: task.label
      };

      tasks.push(newTask);
      targetEsc.tasks = [...tasks];

      // Update node structure
      const next = { ...node };
      if (Array.isArray(next.steps)) {
        const stepIdx = next.steps.findIndex((s: any) => s?.type === stepKey);
        if (stepIdx >= 0) {
          next.steps = [...next.steps];
          next.steps[stepIdx] = { ...next.steps[stepIdx], escalations: [...escalations] };
        } else {
          // Create step if it doesn't exist
          next.steps = [...(next.steps || []), { type: stepKey, escalations: [...escalations] }];
        }
      } else {
        next.steps = { ...(next.steps || {}) };
        next.steps[stepKey] = { ...(next.steps[stepKey] || {}), escalations: [...escalations], type: stepKey };
      }

      try { info('RESPONSE_EDITOR', 'appendTask', { escalationIdx, templateId: newTask.templateId }); } catch { }
      return next;
    });
  }, [node, stepKey]);

  return { editTask, deleteTask, moveTask, dropTaskFromViewer, appendTask };
}

