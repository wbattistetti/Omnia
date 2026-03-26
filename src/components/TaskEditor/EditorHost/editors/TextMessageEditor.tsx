import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { EditorProps } from '../../EditorHost/types';
import { getTaskVisualsByType } from '../../../Flowchart/utils/taskVisuals';
import { taskRepository } from '../../../../services/TaskRepository';
import { useProjectDataUpdate } from '../../../../context/ProjectDataContext';
import { useProjectTranslations } from '../../../../context/ProjectTranslationsContext';
import { TaskType } from '../../../../types/taskTypes';
import { useHeaderToolbarContext } from '../../ResponseEditor/context/HeaderToolbarContext';
import VariableTokenContextMenu from '../../../common/VariableTokenContextMenu';
import { insertBracketTokenAtCaret } from '../../../../utils/variableTokenText';
import {
  convertDSLLabelsToGUIDs,
  convertDSLGUIDsToLabels,
} from '../../../../utils/conditionCodeConverter';
import { getActiveFlowCanvasId } from '../../../../flows/activeFlowCanvas';
import { useFlowActions, useFlowWorkspace } from '../../../../flows/FlowStore';
import { buildVariableMenuItems, buildVariableMappingsFromMenu } from '../../../common/variableMenuModel';
import { useTextTranslationField } from './shared/useTextTranslationField';

export default function TextMessageEditor({ task: taskMeta, onClose }: EditorProps) {
  const instanceId = taskMeta.instanceId || taskMeta.id;
  const pdUpdate = useProjectDataUpdate();
  const { translations, addTranslation, getTranslation } = useProjectTranslations();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [varsMenu, setVarsMenu] = useState<{ open: boolean; x: number; y: number }>({ open: false, x: 0, y: 0 });
  const { flows } = useFlowWorkspace();
  const { updateFlowMeta } = useFlowActions();

  const activeFlowId = getActiveFlowCanvasId();
  const variableMenuItems = React.useMemo(() => {
    const pid = pdUpdate?.getCurrentProjectId() || '';
    if (!pid) return [];
    return buildVariableMenuItems(pid, activeFlowId, flows as any);
  }, [pdUpdate, activeFlowId, flows]);

  const variableMappings = React.useMemo(() => buildVariableMappingsFromMenu(variableMenuItems), [variableMenuItems]);

  const labelsToGuids = useCallback((value: string): string => {
    return convertDSLLabelsToGUIDs(value, variableMappings);
  }, [variableMappings]);

  const guidsToLabels = useCallback((value: string): string => {
    return convertDSLGUIDsToLabels(value, variableMappings);
  }, [variableMappings]);

  const { text, setText } = useTextTranslationField({
    instanceId,
    fallbackTaskType: taskMeta.type ?? TaskType.SayMessage,
    getCurrentProjectId: () => pdUpdate?.getCurrentProjectId() || undefined,
    getTranslation: (k) => getTranslation(k) || '',
    addTranslation,
    encode: labelsToGuids,
    decode: guidsToLabels,
    reloadToken: translations,
    debounceMs: 500,
  });

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
          ref={textareaRef}
          className="w-full h-full rounded-xl border p-3 text-sm"
          value={text}
          onChange={e => {
            setText(e.target.value);
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setVarsMenu({ open: true, x: e.clientX, y: e.clientY });
          }}
          placeholder="Scrivi il messaggio..."
        />
      </div>
      <VariableTokenContextMenu
        isOpen={varsMenu.open}
        x={varsMenu.x}
        y={varsMenu.y}
        variables={variableMenuItems.map((i) => i.varLabel)}
        variableItems={variableMenuItems}
        onClose={() => setVarsMenu({ open: false, x: 0, y: 0 })}
        onExposeAndSelect={(item) => {
          const owner = (flows as any)?.[item.ownerFlowId];
          if (!owner) return;
          const prevVars = Array.isArray(owner?.meta?.variables) ? owner.meta.variables : [];
          const existing = prevVars.find((v: any) => String(v?.id || '').trim() === item.varId);
          const nextVars = existing
            ? prevVars.map((v: any) => (String(v?.id || '').trim() === item.varId ? { ...v, visibility: 'output' } : v))
            : [...prevVars, { id: item.varId, label: item.varLabel, type: 'string', visibility: 'output' }];
          updateFlowMeta(item.ownerFlowId, { variables: nextVars });

          const el = textareaRef.current;
          const caret = {
            start: el?.selectionStart ?? text.length,
            end: el?.selectionEnd ?? text.length,
          };
          const out = insertBracketTokenAtCaret(text, caret, item.tokenLabel || item.varLabel);
          setText(out.text);
          setVarsMenu({ open: false, x: 0, y: 0 });
          requestAnimationFrame(() => {
            if (!el) return;
            el.focus();
            el.setSelectionRange(out.caret.start, out.caret.end);
          });
        }}
        onSelect={(label) => {
          const el = textareaRef.current;
          const caret = {
            start: el?.selectionStart ?? text.length,
            end: el?.selectionEnd ?? text.length,
          };
          const out = insertBracketTokenAtCaret(text, caret, label);
          setText(out.text);
          setVarsMenu({ open: false, x: 0, y: 0 });
          requestAnimationFrame(() => {
            if (!el) return;
            el.focus();
            el.setSelectionRange(out.caret.start, out.caret.end);
          });
        }}
      />
    </div>
  );
}


