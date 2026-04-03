/**
 * Right-click flow/project variable picker for Behaviour and Message Review text fields.
 * Lives in ResponseEditor (not common/) — composes domain stores; parents pass draft + ref.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getActiveFlowCanvasId } from '../../../../flows/activeFlowCanvas';
import { useFlowActions, useFlowWorkspace } from '../../../../flows/FlowStore';
import { useProjectData, useProjectDataUpdate } from '../../../../context/ProjectDataContext';
import { useProjectTranslations } from '../../../../context/ProjectTranslationsContext';
import {
  buildVariableMenuItemsAsync,
  getVariableMenuRebuildFingerprint,
  type VariableMenuItem,
} from '../../../common/variableMenuModel';
import VariableTokenContextMenu from '../../../common/VariableTokenContextMenu';
import { insertBracketTokenAtCaret } from '../../../../utils/variableTokenText';
import { ensureParentVariableAndSubflowOutputBinding } from '../../../common/subflowParentBinding';
import { resolveVariableStoreProjectId } from '../../../../utils/safeProjectId';

export type UseVariablePickerForFlowParams = {
  enabled: boolean;
  editing: boolean;
  draftValue: string;
  setDraftValue: (v: string) => void;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
};

export type UseVariablePickerForFlowResult = {
  onContextMenu: (e: React.MouseEvent<HTMLTextAreaElement>) => void;
  variableMenu: React.ReactNode;
  /**
   * True while the variable menu is open or opening — parent should ignore textarea `onBlur`
   * so blur does not exit editing / delete empty tasks.
   */
  suppressBlurWhileMenuRef: React.MutableRefObject<boolean>;
};

export function useVariablePickerForFlow(
  params: UseVariablePickerForFlowParams
): UseVariablePickerForFlowResult {
  const { enabled, editing, draftValue, setDraftValue, inputRef } = params;
  const suppressBlurWhileMenuRef = useRef(false);
  const [varsMenu, setVarsMenu] = useState<{ open: boolean; x: number; y: number }>({
    open: false,
    x: 0,
    y: 0,
  });
  const { flows } = useFlowWorkspace();
  const { updateFlowMeta } = useFlowActions();
  const pdUpdate = useProjectDataUpdate();
  const { data: projectData } = useProjectData();
  const { translations } = useProjectTranslations();
  const activeFlowId = getActiveFlowCanvasId();
  const [variableMenuItems, setVariableMenuItems] = useState<VariableMenuItem[]>([]);

  const variableMenuFingerprint = useMemo(
    () => getVariableMenuRebuildFingerprint(flows as any, activeFlowId),
    [flows, activeFlowId]
  );
  const projectIdForMenu = useMemo(
    () => resolveVariableStoreProjectId(pdUpdate?.getCurrentProjectId() || undefined),
    [pdUpdate, projectData?.id]
  );

  useEffect(() => {
    let cancelled = false;
    if (!enabled || !editing) {
      setVariableMenuItems([]);
      return;
    }
    void buildVariableMenuItemsAsync(projectIdForMenu, activeFlowId, flows as any, {
      translationsByGuid: translations,
    })
      .then((items) => {
        if (!cancelled) setVariableMenuItems(items);
      })
      .catch(() => {
        if (!cancelled) setVariableMenuItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, editing, projectIdForMenu, activeFlowId, variableMenuFingerprint, flows, translations]);

  useEffect(() => {
    if (!enabled || !editing) {
      suppressBlurWhileMenuRef.current = false;
    }
  }, [enabled, editing]);

  const closeMenu = useCallback(() => {
    suppressBlurWhileMenuRef.current = false;
    setVarsMenu({ open: false, x: 0, y: 0 });
  }, []);

  const applyInsert = useCallback(
    (tokenLabel: string) => {
      const el = inputRef.current;
      const caret = {
        start: el?.selectionStart ?? draftValue.length,
        end: el?.selectionEnd ?? draftValue.length,
      };
      const out = insertBracketTokenAtCaret(draftValue, caret, tokenLabel);
      setDraftValue(out.text);
      closeMenu();
      requestAnimationFrame(() => {
        if (!el) return;
        el.focus();
        el.setSelectionRange(out.caret.start, out.caret.end);
      });
    },
    [draftValue, inputRef, setDraftValue, closeMenu]
  );

  const onContextMenu = useCallback(
    (e: React.MouseEvent<HTMLTextAreaElement>) => {
      if (!enabled) return;
      suppressBlurWhileMenuRef.current = true;
      e.preventDefault();
      e.stopPropagation();
      setVarsMenu({ open: true, x: e.clientX, y: e.clientY });
    },
    [enabled]
  );

  const variableMenu = enabled ? (
    <VariableTokenContextMenu
      isOpen={varsMenu.open}
      x={varsMenu.x}
      y={varsMenu.y}
      variables={variableMenuItems.map((i) => i.varLabel)}
      variableItems={variableMenuItems}
      onClose={closeMenu}
      onExposeAndSelect={(item) => {
        const projectId = pdUpdate?.getCurrentProjectId() || '';
        if (item.isFromActiveFlow === false) {
          if (item.missingChildVariableRef === true) {
            window.alert(
              'Questo parametro di interfaccia non è ancora collegato a una variabile nel sotto-flusso. Apri il flow figlio, collega l’uscita dell’interfaccia a una variabile, poi riprova.'
            );
            return;
          }
          if (!projectId) {
            applyInsert(item.tokenLabel || item.varLabel);
            return;
          }
          const bound = ensureParentVariableAndSubflowOutputBinding(
            projectId,
            activeFlowId,
            flows as any,
            item
          );
          applyInsert(bound.tokenLabel);
          return;
        }

        const owner = (flows as any)?.[item.ownerFlowId];
        if (projectId && owner) {
          const prevVars = Array.isArray(owner?.meta?.variables) ? owner.meta.variables : [];
          const existing = prevVars.find((v: any) => String(v?.id || '').trim() === item.id);
          const nextVars = existing
            ? prevVars.map((v: any) =>
                String(v?.id || '').trim() === item.id ? { ...v, visibility: 'output' } : v
              )
            : [...prevVars, { id: item.id, label: item.varLabel, type: 'string', visibility: 'output' }];
          updateFlowMeta(item.ownerFlowId, { variables: nextVars });
        }
        applyInsert(item.tokenLabel || item.varLabel);
      }}
      onSelect={(label) => {
        applyInsert(label);
      }}
    />
  ) : null;

  return {
    onContextMenu: enabled ? onContextMenu : () => {},
    variableMenu,
    suppressBlurWhileMenuRef,
  };
}
