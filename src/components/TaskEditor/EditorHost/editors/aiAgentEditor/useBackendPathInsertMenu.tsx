/**
 * Right-click menu to insert 🗄️ backend path placeholders using BackendCall labels from the active flow.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { collectBackendRowPathsFromActiveFlow, formatBackendDisplayToken } from '@domain/agentPrompt';
import type { WorkspaceState } from '../../../../../flows/FlowTypes';
import { getActiveFlowCanvasId } from '../../../../../flows/activeFlowCanvas';
import { useFlowWorkspace } from '../../../../../flows/FlowStore';
import { BackendPathInsertContextMenu } from './BackendPathInsertContextMenu';

export type UseBackendPathInsertMenuParams = {
  enabled: boolean;
  readOnly: boolean;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  /** Insert token; range replaces [rangeStart, rangeEnd) when rangeEnd > rangeStart. */
  onInsert: (backendPath: string, rangeStart: number, rangeEnd: number) => void;
};

export type UseBackendPathInsertMenuResult = {
  onContextMenu: (e: React.MouseEvent<HTMLTextAreaElement>) => void;
  backendPathMenu: React.ReactNode;
  suppressBlurWhileMenuRef: React.MutableRefObject<boolean>;
};

export function useBackendPathInsertMenu(
  params: UseBackendPathInsertMenuParams
): UseBackendPathInsertMenuResult {
  const { enabled, readOnly, inputRef, onInsert } = params;
  const suppressBlurWhileMenuRef = useRef(false);
  const [menu, setMenu] = useState<{ open: boolean; x: number; y: number }>({
    open: false,
    x: 0,
    y: 0,
  });

  const { flows } = useFlowWorkspace();
  const activeFlowId = getActiveFlowCanvasId();

  const paths = useMemo(
    () => collectBackendRowPathsFromActiveFlow(flows as WorkspaceState['flows'], activeFlowId),
    [flows, activeFlowId]
  );

  const closeMenu = useCallback(() => {
    suppressBlurWhileMenuRef.current = false;
    setMenu({ open: false, x: 0, y: 0 });
  }, []);

  useEffect(() => {
    if (!enabled || readOnly) {
      suppressBlurWhileMenuRef.current = false;
    }
  }, [enabled, readOnly]);

  const applyInsert = useCallback(
    (path: string) => {
      const el = inputRef.current;
      const raw = String(path ?? '').trim();
      if (!raw) return;
      const tokenLen = formatBackendDisplayToken(raw).length;
      const a = el?.selectionStart ?? 0;
      const b = el?.selectionEnd ?? a;
      const s = Math.min(a, b);
      const e = Math.max(a, b);
      onInsert(raw, s, e);
      closeMenu();
      requestAnimationFrame(() => {
        if (!el) return;
        el.focus();
        const after = s + tokenLen;
        try {
          el.setSelectionRange(after, after);
        } catch {
          /* ignore */
        }
      });
    },
    [inputRef, onInsert, closeMenu]
  );

  const onContextMenu = useCallback(
    (e: React.MouseEvent<HTMLTextAreaElement>) => {
      if (!enabled || readOnly) return;
      suppressBlurWhileMenuRef.current = true;
      e.preventDefault();
      e.stopPropagation();
      setMenu({ open: true, x: e.clientX, y: e.clientY });
    },
    [enabled, readOnly]
  );

  const backendPathMenu =
    enabled && !readOnly ? (
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
    onContextMenu: enabled && !readOnly ? onContextMenu : () => {},
    backendPathMenu,
    suppressBlurWhileMenuRef,
  };
}
