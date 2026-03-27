import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
import {
  buildSubflowCompositeKeySet,
  buildVariableMenuItemsAsync,
  buildVariableMappingsFromMenu,
  type VariableMenuItem,
} from '../../../common/variableMenuModel';
import { variableCreationService } from '../../../../services/VariableCreationService';
import { ensureParentVariableAndSubflowOutputBinding } from '../../../common/subflowParentBinding';
import { useTextTranslationField } from './shared/useTextTranslationField';
import { fingerprintVariableMapping } from './shared/variableMappingFingerprint';

export default function TextMessageEditor({ task: taskMeta, onClose }: EditorProps) {
  const instanceId = taskMeta.instanceId || taskMeta.id;
  const pdUpdate = useProjectDataUpdate();
  const { translations, addTranslation, getTranslation } = useProjectTranslations();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [varsMenu, setVarsMenu] = useState<{ open: boolean; x: number; y: number }>({ open: false, x: 0, y: 0 });
  const { flows } = useFlowWorkspace();
  const { updateFlowMeta } = useFlowActions();
  const [variableMenuItems, setVariableMenuItems] = useState<VariableMenuItem[]>([]);

  const activeFlowId = getActiveFlowCanvasId();
  useEffect(() => {
    let cancelled = false;
    const pid = pdUpdate?.getCurrentProjectId() || '';
    if (!pid) {
      setVariableMenuItems([]);
      return;
    }
    void buildVariableMenuItemsAsync(pid, activeFlowId, flows as any).then((items) => {
      if (!cancelled) setVariableMenuItems(items);
    }).catch(() => {
      if (!cancelled) setVariableMenuItems([]);
    });
    return () => {
      cancelled = true;
    };
  }, [pdUpdate, activeFlowId, flows]);

  const variableMappings = React.useMemo(() => buildVariableMappingsFromMenu(variableMenuItems), [variableMenuItems]);

  const variableMappingFingerprint = useMemo(
    () => fingerprintVariableMapping(variableMappings),
    [variableMappings]
  );

  const getCurrentProjectId = useCallback(
    () => pdUpdate?.getCurrentProjectId() || undefined,
    [pdUpdate]
  );

  const subflowCompositeKeys = React.useMemo(
    () => buildSubflowCompositeKeySet(variableMenuItems),
    [variableMenuItems]
  );

  const labelsToGuids = useCallback(
    (value: string): string => {
      return convertDSLLabelsToGUIDs(value, variableMappings, { preferKeysForEncode: subflowCompositeKeys });
    },
    [variableMappings, subflowCompositeKeys]
  );

  const guidsToLabels = useCallback(
    (value: string): string => {
      const projectId = pdUpdate?.getCurrentProjectId() || '';
      return convertDSLGUIDsToLabels(value, variableMappings, {
        resolveUnknownGuidToLabel: (guid) =>
          projectId ? variableCreationService.getVarNameByVarId(projectId, guid) : null,
      });
    },
    [variableMappings, pdUpdate]
  );

  const getTranslationForField = useCallback(
    (k: string) => getTranslation(k) ?? '',
    [getTranslation]
  );

  const { text, setText } = useTextTranslationField({
    instanceId,
    fallbackTaskType: taskMeta.type ?? TaskType.SayMessage,
    getCurrentProjectId,
    getTranslation: getTranslationForField,
    addTranslation,
    encode: labelsToGuids,
    decode: guidsToLabels,
    reloadToken: translations,
    decodeContextKey: variableMappingFingerprint,
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
          const projectId = pdUpdate?.getCurrentProjectId() || '';
          if (!projectId) return;
          if (item.isFromActiveFlow === false) {
            const bound = ensureParentVariableAndSubflowOutputBinding(
              projectId,
              activeFlowId,
              flows as any,
              item
            );
            const el = textareaRef.current;
            const caret = {
              start: el?.selectionStart ?? text.length,
              end: el?.selectionEnd ?? text.length,
            };
            const out = insertBracketTokenAtCaret(text, caret, bound.tokenLabel);
            setText(out.text);
            setVarsMenu({ open: false, x: 0, y: 0 });
            requestAnimationFrame(() => {
              if (!el) return;
              el.focus();
              el.setSelectionRange(out.caret.start, out.caret.end);
            });
            return;
          }

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


