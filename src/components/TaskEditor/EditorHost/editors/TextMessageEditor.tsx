import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { EditorProps } from '../../EditorHost/types';
import { getTaskVisualsByType } from '../../../Flowchart/utils/taskVisuals';
import { taskRepository } from '../../../../services/TaskRepository';
import { useProjectData, useProjectDataUpdate } from '../../../../context/ProjectDataContext';
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
  getVariableMenuRebuildFingerprint,
  type VariableMenuItem,
} from '../../../common/variableMenuModel';
import { variableCreationService } from '../../../../services/VariableCreationService';
import { ensureParentVariableAndSubflowOutputBinding } from '../../../common/subflowParentBinding';
import { useTextTranslationField } from './shared/useTextTranslationField';
import { fingerprintVariableMapping } from './shared/variableMappingFingerprint';
import { logVariableMenuDebug } from '../../../../utils/variableMenuDebug';
import { resolveVariableStoreProjectId } from '../../../../utils/safeProjectId';

export default function TextMessageEditor({ task: taskMeta, onClose }: EditorProps) {
  const instanceId = taskMeta.instanceId || taskMeta.id;
  const pdUpdate = useProjectDataUpdate();
  const { data: projectData } = useProjectData();
  const { translations, addTranslation, getTranslation } = useProjectTranslations();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [varsMenu, setVarsMenu] = useState<{ open: boolean; x: number; y: number }>({ open: false, x: 0, y: 0 });
  const { flows } = useFlowWorkspace();
  const { updateFlowMeta } = useFlowActions();
  const [variableMenuItems, setVariableMenuItems] = useState<VariableMenuItem[]>([]);

  const activeFlowId = getActiveFlowCanvasId();
  const menuFlowId = useMemo(() => {
    const targetTaskId = String(instanceId || taskMeta.id || '').trim();
    if (!targetTaskId) return activeFlowId;
    for (const [flowId, flow] of Object.entries(flows as Record<string, any>)) {
      for (const node of (flow?.nodes || [])) {
        for (const row of (node?.data?.rows || [])) {
          if (String(row?.id || '').trim() === targetTaskId) {
            return String(flowId || '').trim() || activeFlowId;
          }
        }
      }
    }
    return activeFlowId;
  }, [flows, instanceId, taskMeta.id, activeFlowId]);

  const variableMenuFingerprint = useMemo(
    () => getVariableMenuRebuildFingerprint(flows as any, menuFlowId),
    [flows, menuFlowId]
  );

  const projectIdForMenu = useMemo(
    () => resolveVariableStoreProjectId(pdUpdate?.getCurrentProjectId() || undefined),
    [pdUpdate, projectData?.id]
  );

  useEffect(() => {
    let cancelled = false;
    void buildVariableMenuItemsAsync(projectIdForMenu, menuFlowId, flows as any, {
      translationsByGuid: translations,
    })
      .then((items) => {
        if (!cancelled) setVariableMenuItems(items);
      })
      .catch((err) => {
        logVariableMenuDebug('variableMenu:buildFailed', {
          menuFlowId,
          error: err instanceof Error ? err.message : String(err),
        });
        if (!cancelled) setVariableMenuItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [projectIdForMenu, menuFlowId, variableMenuFingerprint, translations]);

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
          getTranslation(guid) ||
          (projectId ? variableCreationService.getVarNameById(projectId, guid) : null),
      });
    },
    [variableMappings, pdUpdate, getTranslation]
  );

  const getTranslationForField = useCallback(
    (k: string) => getTranslation(k) ?? '',
    [getTranslation]
  );

  const { text, setText, flushNow } = useTextTranslationField({
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
  const setHeaderIcon = headerContext?.setIcon;
  const setHeaderTitle = headerContext?.setTitle;
  const { Icon, color } = getTaskVisualsByType(taskMeta.type ?? TaskType.SayMessage, false);

  React.useEffect(() => {
    if (!setHeaderIcon || !setHeaderTitle) return;
    setHeaderIcon(<Icon size={18} style={{ color }} />);
    setHeaderTitle(String(taskMeta?.label || 'Message'));

    return () => {
      setHeaderIcon(null);
      setHeaderTitle(null);
    };
    // Depend on stable setters from HeaderToolbarProvider, not the whole context value.
  }, [setHeaderIcon, setHeaderTitle, taskMeta?.label, taskMeta?.type, Icon, color]);

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
          onBlur={() => {
            flushNow();
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
            if (item.missingChildVariableRef === true) {
              window.alert(
                'Questo parametro di interfaccia non è ancora collegato a una variabile nel sotto-flusso. Apri il flow figlio, collega l’uscita dell’interfaccia a una variabile, poi riprova.'
              );
              return;
            }
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
          const existing = prevVars.find((v: any) => String(v?.id || '').trim() === item.id);
          const nextVars = existing
            ? prevVars.map((v: any) => (String(v?.id || '').trim() === item.id ? { ...v, visibility: 'output' } : v))
            : [...prevVars, { id: item.id, label: item.varLabel, type: 'string', visibility: 'output' }];
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


