import React, { useState, useEffect, useMemo } from 'react';
import type { EditorProps } from '../../EditorHost/types';
import EditorHeader from '../../../common/EditorHeader';
import { getTaskVisualsByType } from '../../../Flowchart/utils/taskVisuals';
import { taskRepository } from '../../../../services/TaskRepository';
import { useProjectDataUpdate } from '../../../../context/ProjectDataContext';
import { TaskType } from '../../../../types/taskTypes'; // ✅ Aggiunto import TaskType

export default function TextMessageEditor({ task: taskMeta, onClose }: EditorProps) { // ✅ RINOMINATO: act → taskMeta
  const instanceId = taskMeta.instanceId || taskMeta.id; // ✅ RINOMINATO: act → taskMeta
  const pdUpdate = useProjectDataUpdate();

  console.log('[TextMessageEditor] Mounted', {
    instanceId,
    taskType: taskMeta.type,
    taskLabel: taskMeta.label,
    taskId: taskMeta.id
  });

  // FASE 3: Read initial text from Task (create if doesn't exist, like DDTHostAdapter)
  // Use useState initializer function to compute once on mount only
  const [text, setText] = useState(() => {
    if (!instanceId) {
      console.log('[TextMessageEditor] No instanceId, returning empty text');
      return '';
    }
    let taskInstance = taskRepository.getTask(instanceId);
    console.log('[TextMessageEditor] Initial load', {
      instanceId,
      taskExists: !!taskInstance,
      taskText: taskInstance?.text?.substring(0, 50) || '',
      taskType: taskInstance?.type
    });
    if (!taskInstance) {
      // ✅ Usa direttamente taskMeta.type (TaskType enum) invece di convertire da stringa
      const taskType = taskMeta.type ?? TaskType.SayMessage; // ✅ Usa direttamente taskMeta.type (TaskType enum)
      const projectId = pdUpdate?.getCurrentProjectId() || undefined;
      console.log('[TextMessageEditor] Creating new task', { instanceId, taskType, projectId });
      taskInstance = taskRepository.createTask(taskType, null, undefined, instanceId, projectId);
    }
    return taskInstance?.text || '';
  });

  // FIX: Reload text from Task when instanceId changes or when Task is updated
  useEffect(() => {
    if (!instanceId) return;

    // Check if Task exists and has different text (only on mount or instanceId change)
    const task = taskRepository.getTask(instanceId);
    if (task?.text !== undefined) {
      setText(prevText => {
        if (prevText !== task.text) {
          console.log('[TextMessageEditor] Reloading text from Task', {
            instanceId,
            oldText: prevText.substring(0, 50),
            newText: task.text?.substring(0, 50) || ''
          });
          return task.text || '';
        }
        return prevText;
      });
    }

    // Listen for instance updates (backward compatibility during migration)
    const handleInstanceUpdate = (event: CustomEvent) => {
      const { instanceId: updatedInstanceId } = event.detail || {};
      if (updatedInstanceId === instanceId) {
        // Task was updated, reload text
        const updatedTask = taskRepository.getTask(instanceId);
        if (updatedTask?.text !== undefined) {
          setText(prevText => {
            if (prevText !== updatedTask.text) {
              console.log('[TextMessageEditor] Task updated, reloading text', {
                instanceId,
                newText: updatedTask.text?.substring(0, 50) || ''
              });
              return updatedTask.text || '';
            }
            return prevText;
          });
        }
      }
    };

    window.addEventListener('instanceRepository:updated', handleInstanceUpdate as EventListener);

    return () => {
      window.removeEventListener('instanceRepository:updated', handleInstanceUpdate as EventListener);
    };
  }, [instanceId]); // Only reload when instanceId changes

  // FASE 3: Update Task when text changes (TaskRepository syncs with InstanceRepository automatically)
  useEffect(() => {
    if (instanceId && text !== undefined) {
      // FIX: Pass projectId to save to database immediately
      const projectId = pdUpdate?.getCurrentProjectId() || undefined;
      taskRepository.updateTask(instanceId, { text }, projectId);
    }
  }, [text, instanceId, pdUpdate]);

  // ✅ REMOVED: updateInstance (legacy act_instances) - taskRepository.updateTask already saves to database
  const handleClose = async () => {
    if (instanceId) {
      // ✅ TaskRepository automatically syncs with database, no need for separate save
      // broadcast per aggiornare la riga
      try { document.dispatchEvent(new CustomEvent('rowMessage:update', { detail: { instanceId, text } })); } catch { }
    }
    onClose?.();
  };

  return (
    <div className="h-full bg-white flex flex-col min-h-0">
      {(() => {
        // ✅ Usa direttamente taskMeta.type (TaskType enum) invece di convertire da stringa
        // ✅ TODO FUTURO: Category System (vedi documentation/TODO_NUOVO.md)
        // Aggiornare per usare getTaskVisuals(taskMeta.type ?? TaskType.SayMessage, taskMeta?.category, taskMeta?.categoryCustom, false)
        const { Icon, color } = getTaskVisualsByType(taskMeta.type ?? TaskType.SayMessage, false); // ✅ RINOMINATO: act → taskMeta
        return (
          <EditorHeader
            icon={<Icon size={18} style={{ color }} />}
            title={String(taskMeta?.label || 'Message')} // ✅ RINOMINATO: act → taskMeta
            color="orange"
            onClose={handleClose}
          />
        );
      })()}
      <div className="p-4 flex-1 min-h-0 flex">
        <textarea
          className="w-full h-full rounded-xl border p-3 text-sm"
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Scrivi il messaggio..."
        />
      </div>
    </div>
  );
}


