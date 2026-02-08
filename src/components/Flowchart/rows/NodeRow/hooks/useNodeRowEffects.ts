// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useEffect } from 'react';
import type { Row } from '@types/NodeRowTypes';

export interface UseNodeRowEffectsProps {
  row: Row;
  isEditing: boolean;
  setIsEditing: (value: boolean) => void;
  showIntellisense: boolean;
  setShowIntellisense: (value: boolean) => void;
  setIntellisenseQuery: (value: string) => void;
  showCreatePicker: boolean;
  setShowCreatePicker: (value: boolean) => void;
  setAllowCreatePicker: (value: boolean) => void;
  showIcons: boolean;
  setShowIcons: (value: boolean) => void;
  setIconPos: (pos: { top: number; left: number } | null) => void;
  hasEverBeenEditing: boolean;
  setHasEverBeenEditing: (value: boolean) => void;
  currentText: string;
  setCurrentText: (text: string) => void;
  forceEditing: boolean;
  suppressIntellisenseRef: React.MutableRefObject<boolean>;
  inputRef: React.RefObject<HTMLTextAreaElement>;
  labelRef: React.RefObject<HTMLElement>;
  typeToolbarRef: React.RefObject<HTMLElement>;
  toolbarSM: {
    showIcons: boolean;
    showPicker: boolean;
  };
  onEditingEnd?: (rowId: string) => void;
  registerRow: (id: string, methods: { fade: () => void; highlight: () => void; normal: () => void }) => void;
  unregisterRow: (id: string) => void;
  fade: () => void;
  highlight: () => void;
  normal: () => void;
  debugFlowIcons: boolean;
  nodeOverlayPosition: { left: number; top: number } | null;
}

/**
 * Custom hook that encapsulates all useEffect logic for NodeRow.
 * This significantly reduces the size of the main component by extracting
 * all side effects into a separate, testable hook.
 */
export function useNodeRowEffects(props: UseNodeRowEffectsProps): void {
  const {
    row,
    isEditing,
    setIsEditing,
    showIntellisense,
    setShowIntellisense,
    setIntellisenseQuery,
    showCreatePicker,
    setShowCreatePicker,
    setAllowCreatePicker,
    showIcons,
    setShowIcons,
    setIconPos,
    hasEverBeenEditing,
    setHasEverBeenEditing,
    currentText,
    setCurrentText,
    forceEditing,
    suppressIntellisenseRef,
    inputRef,
    labelRef,
    typeToolbarRef,
    toolbarSM,
    onEditingEnd,
    registerRow,
    unregisterRow,
    fade,
    highlight,
    normal,
    debugFlowIcons,
    nodeOverlayPosition,
  } = props;

  // Register component in registry
  useEffect(() => {
    registerRow(row.id, { fade, highlight, normal });
    return () => unregisterRow(row.id);
  }, [row.id, fade, highlight, normal, registerRow, unregisterRow]);

  // ESC: when type toolbar is open, close it and refocus textbox without propagating to canvas
  useEffect(() => {
    if (!showCreatePicker) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      try {
        e.preventDefault();
        e.stopPropagation();
      } catch {
        // Ignore errors
      }
      setShowCreatePicker(false);
      setAllowCreatePicker(false);
      suppressIntellisenseRef.current = true;
      // restore focus to the editor textarea
      try {
        if (inputRef.current) {
          const el = inputRef.current;
          el.focus();
          // place caret at end
          const val = el.value || '';
          el.setSelectionRange(val.length, val.length);
        }
      } catch {
        // Ignore errors
      }
    };
    document.addEventListener('keydown', onEsc, true);
    return () => document.removeEventListener('keydown', onEsc, true);
  }, [showCreatePicker, setShowCreatePicker, setAllowCreatePicker, suppressIntellisenseRef, inputRef]);

  // Debug: track picker visibility/position
  useEffect(() => {
    // no-op (debug tracking disabled by default)
  }, [showCreatePicker, nodeOverlayPosition]);

  // reset suppression when editing ends
  useEffect(() => {
    if (!isEditing) suppressIntellisenseRef.current = false;
  }, [isEditing, suppressIntellisenseRef]);

  // Intercept global keys when type toolbar is open, to prevent them from reaching canvas
  useEffect(() => {
    if (!showCreatePicker) return;
    const onGlobalKeyDown = (ev: KeyboardEvent) => {
      const keys = ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'Enter', 'Escape'];
      if (keys.includes(ev.key)) {
        const t = ev.target as Node | null;
        if (typeToolbarRef.current && t instanceof Node && typeToolbarRef.current.contains(t)) {
          return; // let it pass to toolbar
        }
        ev.preventDefault();
        ev.stopPropagation();
      }
    };
    window.addEventListener('keydown', onGlobalKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onGlobalKeyDown, { capture: true } as any);
  }, [showCreatePicker, typeToolbarRef]);

  // Calculate icon position: just OUTSIDE the right edge of the node, at label height
  // With small gap to avoid overlap at border
  useEffect(() => {
    if (showIcons && labelRef.current) {
      const labelRect = labelRef.current.getBoundingClientRect();
      const nodeEl = labelRef.current.closest('.react-flow__node') as HTMLElement | null;
      const nodeRect = nodeEl ? nodeEl.getBoundingClientRect() : labelRect;
      setIconPos({
        top: labelRect.top,
        left: nodeRect.right + 4, // Small gap to avoid overlap at border
      });
    } else {
      setIconPos(null);
    }
  }, [showIcons, labelRef, setIconPos]);

  // Bridge SM → local booleans used by layout effects
  useEffect(() => {
    if (toolbarSM.showIcons !== showIcons) setShowIcons(toolbarSM.showIcons);
    if (toolbarSM.showPicker !== showCreatePicker) setShowCreatePicker(toolbarSM.showPicker);
  }, [toolbarSM.showIcons, toolbarSM.showPicker, showIcons, showCreatePicker, setShowIcons, setShowCreatePicker]);

  // Handle forceEditing prop changes
  useEffect(() => {
    if (forceEditing) {
      setIsEditing(true);
    } else {
      // When forceEditing becomes false, exit editing mode
      // This ensures the row returns to label mode when it loses focus
      setIsEditing(false);
    }
  }, [forceEditing, setIsEditing]);

  // Debug disabled by default (enable with debug.flowIcons)
  useEffect(() => {
    // no-op (debug tracking disabled by default)
  }, [showIcons, row.id, debugFlowIcons]);

  // Track if we've ever entered editing
  useEffect(() => {
    if (isEditing) {
      setHasEverBeenEditing(true);
    }
  }, [isEditing, setHasEverBeenEditing]);

  // Call onEditingEnd when exiting editing (was true, now false)
  // And if we've ever entered editing
  useEffect(() => {
    if (!isEditing && hasEverBeenEditing && typeof onEditingEnd === 'function') {
      onEditingEnd(row.id);
    }
  }, [isEditing, hasEverBeenEditing, row.id, onEditingEnd]);

  // Canvas click = ESC semantics: close intellisense if open, otherwise end editing without deleting
  useEffect(() => {
    const handleCanvasClick = () => {
      if (!isEditing) return;
      if (showIntellisense) {
        setShowIntellisense(false);
        setIntellisenseQuery('');
        return;
      }
      // End editing gracefully, keep the row/node even if empty
      setCurrentText(row.text);
      setIsEditing(false);
      setShowIntellisense(false);
      setIntellisenseQuery('');
      if (typeof onEditingEnd === 'function') {
        onEditingEnd(row.id);
      }
    };
    window.addEventListener('flow:canvas:click', handleCanvasClick as any, { capture: false } as any);
    return () => window.removeEventListener('flow:canvas:click', handleCanvasClick as any);
  }, [isEditing, showIntellisense, row.text, onEditingEnd, setCurrentText, setIsEditing, setShowIntellisense, setIntellisenseQuery]);
}
