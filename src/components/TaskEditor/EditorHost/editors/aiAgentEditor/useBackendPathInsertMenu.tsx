/**
 * Right-click menu to insert 🗄️ backend path placeholders using BackendCall labels from the active flow.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { collectBackendRowPathsFromActiveFlow, formatBackendDisplayToken } from '@domain/agentPrompt';
import type { WorkspaceState } from '../../../../../flows/FlowTypes';
import { getActiveFlowCanvasId } from '../../../../../flows/activeFlowCanvas';
import { useFlowWorkspaceOptional } from '../../../../../flows/FlowStore';
import { BackendPathInsertContextMenu } from './BackendPathInsertContextMenu';
import type { BackendPathSelectionAdapter } from './backendPathSelectionAdapter';

export type UseBackendPathInsertMenuParams = {
  enabled: boolean;
  readOnly: boolean;
  selection: BackendPathSelectionAdapter;
  /** Insert token; range replaces [rangeStart, rangeEnd) when rangeEnd > rangeStart. */
  onInsert: (backendPath: string, rangeStart: number, rangeEnd: number) => void;
};

export type UseBackendPathInsertMenuResult = {
  onContextMenu: (e: React.MouseEvent) => void;
  backendPathMenu: React.ReactNode;
  suppressBlurWhileMenuRef: React.MutableRefObject<boolean>;
};

export function useBackendPathInsertMenu(
  params: UseBackendPathInsertMenuParams
): UseBackendPathInsertMenuResult {
  const { enabled, readOnly, selection, onInsert } = params;
  const suppressBlurWhileMenuRef = useRef(false);
  const [menu, setMenu] = useState<{ open: boolean; x: number; y: number }>({
    open: false,
    x: 0,
    y: 0,
  });

  const workspace = useFlowWorkspaceOptional();
  const flows = workspace?.flows;
  const activeFlowId = getActiveFlowCanvasId();
  const hasFlowWorkspace = workspace != null;
  const menuEnabled = enabled && hasFlowWorkspace;

  const paths = useMemo(
    () =>
      hasFlowWorkspace
        ? collectBackendRowPathsFromActiveFlow(
            flows as WorkspaceState['flows'],
            activeFlowId
          )
        : [],
    [hasFlowWorkspace, flows, activeFlowId]
  );

  const closeMenu = useCallback(() => {
    suppressBlurWhileMenuRef.current = false;
    setMenu({ open: false, x: 0, y: 0 });
  }, []);

  useEffect(() => {
    if (!menuEnabled || readOnly) {
      suppressBlurWhileMenuRef.current = false;
    }
  }, [menuEnabled, readOnly]);

  const applyInsert = useCallback(
    (path: string) => {
      const raw = String(path ?? '').trim();
      if (!raw) return;
      const tokenLen = formatBackendDisplayToken(raw).length;
      const { start: s, end: e } = selection.getRange();
      onInsert(raw, s, e);
      closeMenu();
      requestAnimationFrame(() => {
        selection.focus();
        selection.setCaret(s + tokenLen);
      });
    },
    [selection, onInsert, closeMenu]
  );

  const onContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (!menuEnabled || readOnly) return;
      suppressBlurWhileMenuRef.current = true;
      e.preventDefault();
      e.stopPropagation();
      setMenu({ open: true, x: e.clientX, y: e.clientY });
    },
    [menuEnabled, readOnly]
  );

  const backendPathMenu =
    menuEnabled && !readOnly ? (
      <BackendPathInsertContextMenu
        isOpen={menu.open}
        x={menu.x}
        y={menu.y}
        paths={paths}
        onClose={closeMenu}
        onSelect={applyInsert}
      />
    ) : null;

  return {
    onContextMenu: menuEnabled && !readOnly ? onContextMenu : () => {},
    backendPathMenu,
    suppressBlurWhileMenuRef,
  };
}
