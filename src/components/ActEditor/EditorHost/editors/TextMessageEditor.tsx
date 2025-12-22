import React, { useState, useEffect, useMemo } from 'react';
import type { EditorProps } from '../../EditorHost/types';
import EditorHeader from '../../../common/EditorHeader';
import { getTaskVisualsByType } from '../../../Flowchart/utils/taskVisuals';
import { taskRepository } from '../../../../services/TaskRepository';
import { useProjectDataUpdate } from '../../../../context/ProjectDataContext';

export default function TextMessageEditor({ act, onClose }: EditorProps) {
  const instanceId = act.instanceId || act.id;
  const pdUpdate = useProjectDataUpdate();

  // FASE 3: Read initial text from Task (create if doesn't exist, like DDTHostAdapter)
  // Use useState initializer function to compute once on mount only
  const [text, setText] = useState(() => {
    if (!instanceId) return '';
    let task = taskRepository.getTask(instanceId);
    if (!task) {
      const actId = act.id || '';
      // Map actId to action (e.g., 'Message' -> 'SayMessage')
      const action = actId === 'Message' ? 'SayMessage' : actId;
      const projectId = pdUpdate?.getCurrentProjectId() || undefined;
      task = taskRepository.createTask(action, undefined, instanceId, projectId);
    }
    return task?.text || '';
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

  // Save to database on close
  const handleClose = async () => {
    if (instanceId) {
      try {
        const { ProjectDataService } = await import('../../../../services/ProjectDataService');
        const pid = pdUpdate?.getCurrentProjectId() || undefined;
        if (pid) {
          void ProjectDataService.updateInstance(pid, instanceId, { message: { text } })
            .catch((e: any) => { try { console.warn('[TextMessageEditor][close][PUT fail]', e); } catch { } });
          // broadcast per aggiornare la riga
          try { document.dispatchEvent(new CustomEvent('rowMessage:update', { detail: { instanceId, text } })); } catch { }
        }
      } catch { }
    }
    onClose?.();
  };

  return (
    <div className="h-full bg-white flex flex-col min-h-0">
      {(() => {
        const type = String(act?.type || 'Message') as any;
        const { Icon, color } = getTaskVisualsByType(type, false);
        return (
          <EditorHeader
            icon={<Icon size={18} style={{ color }} />}
            title={String(act?.label || 'Message')}
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


