import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { EditorProps } from '../../EditorHost/types';
import { getTaskVisualsByType } from '../../../Flowchart/utils/taskVisuals';
import { taskRepository } from '../../../../services/TaskRepository';
import { useProjectDataUpdate } from '../../../../context/ProjectDataContext';
import { useProjectTranslations } from '../../../../context/ProjectTranslationsContext';
import { TaskType } from '../../../../types/taskTypes';
import { useHeaderToolbarContext } from '../../ResponseEditor/context/HeaderToolbarContext';
import { v4 as uuidv4 } from 'uuid';

export default function TextMessageEditor({ task: taskMeta, onClose }: EditorProps) {
  const instanceId = taskMeta.instanceId || taskMeta.id;
  const pdUpdate = useProjectDataUpdate();
  const { translations, addTranslation, getTranslation } = useProjectTranslations();
  const isUserTypingRef = useRef(false); // Track if user is actively typing
  const lastLoadedTranslationRef = useRef<string | null>(null); // Track last loaded translation

  // ✅ Get or create textKey from task parameters (GUID) - same pattern as TaskUtterance
  const getTextKey = useCallback((): string | null => {
    if (!instanceId) return null;

    const taskInstance = taskRepository.getTask(instanceId);
    if (!taskInstance) return null;

    // Extract textKey from parameters (parameterId='text', value=GUID)
    const textParam = taskInstance.parameters?.find((p: any) => p?.parameterId === 'text');
    const textKey = textParam?.value;

    // If textKey exists and is a valid string, use it
    if (textKey && typeof textKey === 'string') {
      return textKey;
    }

    // ✅ If no textKey exists, create a new GUID and save it to task parameters
    const newTextKey = uuidv4();
    const projectId = pdUpdate?.getCurrentProjectId() || undefined;
    taskRepository.updateTask(instanceId, {
      parameters: [{ parameterId: 'text', value: newTextKey }]
    }, projectId);

    console.log('[TextMessageEditor] ✅ Created new textKey', { instanceId, newTextKey });
    return newTextKey;
  }, [instanceId, pdUpdate]);

  // ✅ Load initial text from translations using textKey - same pattern as TaskUtterance
  const [text, setText] = useState(() => {
    if (!instanceId) {
      console.log('[TextMessageEditor] No instanceId, returning empty text');
      return '';
    }

    let taskInstance = taskRepository.getTask(instanceId);
    console.log('[TextMessageEditor] Initial load', {
      instanceId,
      taskExists: !!taskInstance,
      taskType: taskInstance?.type
    });

    if (!taskInstance) {
      const taskType = taskMeta.type ?? TaskType.SayMessage;
      const projectId = pdUpdate?.getCurrentProjectId() || undefined;
      console.log('[TextMessageEditor] Creating new task', { instanceId, taskType, projectId });
      taskInstance = taskRepository.createTask(taskType, null, undefined, instanceId, projectId);
    }

    // ✅ Get textKey and load translation (same pattern as TaskUtterance)
    const textParam = taskInstance.parameters?.find((p: any) => p?.parameterId === 'text');
    const textKey = textParam?.value;

    if (textKey && typeof textKey === 'string') {
      // Note: getTranslation might not be available in initializer, so we'll use useEffect for loading
      return '';
    }

    return '';
  });

  // ✅ Reload text when translations change or instanceId changes (NOT when text changes - avoid loop)
  useEffect(() => {
    if (!instanceId) return;

    // Don't reload if user is actively typing
    if (isUserTypingRef.current) {
      return;
    }

    const textKey = getTextKey();
    if (textKey) {
      const translation = getTranslation(textKey) || '';

      // Only update if translation actually changed (not just because text changed)
      if (translation !== lastLoadedTranslationRef.current) {
        setText(translation);
        lastLoadedTranslationRef.current = translation;
        console.log('[TextMessageEditor] ✅ Loaded translation', { textKey, hasTranslation: !!translation });
      }
    }
  }, [instanceId, translations, getTextKey, getTranslation]); // ✅ Removed 'text' from dependencies to avoid loop

  // ✅ Save text to translations when user types (debounced) - same pattern as TaskUtterance
  useEffect(() => {
    if (!instanceId) return;

    const textKey = getTextKey();
    if (!textKey) return;

    // Mark that user is typing
    isUserTypingRef.current = true;

    // Debounce: save after 500ms of no typing
    const timeoutId = setTimeout(() => {
      if (text.trim()) {
        addTranslation(textKey, text);
        lastLoadedTranslationRef.current = text; // Update last loaded to match what we just saved
        console.log('[TextMessageEditor] 💾 Saved translation', { textKey, textPreview: text.substring(0, 50) });
      }
      // Reset typing flag after debounce completes
      isUserTypingRef.current = false;
    }, 500);

    return () => {
      clearTimeout(timeoutId);
      // Reset typing flag if component unmounts or effect re-runs
      isUserTypingRef.current = false;
    };
  }, [text, instanceId, getTextKey, addTranslation]);

  // ✅ Save on close (backup - in case debounce didn't fire)
  const handleClose = async () => {
    if (instanceId) {
      const textKey = getTextKey();
      if (textKey && text.trim()) {
        addTranslation(textKey, text);
        console.log('[TextMessageEditor] 💾 Saved translation on close', { textKey, textPreview: text.substring(0, 50) });
      }

      // Broadcast per aggiornare la riga
      try {
        document.dispatchEvent(new CustomEvent('rowMessage:update', { detail: { instanceId, text } }));
      } catch { }
    }
    onClose?.();
  };

  // ✅ ARCHITECTURE: Inject icon and title into main header (no local header)
  const headerContext = useHeaderToolbarContext();
  const { Icon, color } = getTaskVisualsByType(taskMeta.type ?? TaskType.SayMessage, false);

  React.useEffect(() => {
    if (headerContext) {
      // Inject icon and title into main header
      headerContext.setIcon(<Icon size={18} style={{ color }} />);
      headerContext.setTitle(String(taskMeta?.label || 'Message'));

      return () => {
        // Cleanup: remove injected values when editor unmounts
        headerContext.setIcon(null);
        headerContext.setTitle(null);
      };
    }
  }, [headerContext, taskMeta?.label, taskMeta?.type, Icon, color]);

  return (
    <div className="h-full bg-white flex flex-col min-h-0">
      {/* ✅ ARCHITECTURE: No local header - icon/title are injected into main header */}
      <div className="p-4 flex-1 min-h-0 flex">
        <textarea
          className="w-full h-full rounded-xl border p-3 text-sm"
          value={text}
          onChange={e => {
            isUserTypingRef.current = true; // Mark that user is typing
            setText(e.target.value);
          }}
          placeholder="Scrivi il messaggio..."
        />
      </div>
    </div>
  );
}


