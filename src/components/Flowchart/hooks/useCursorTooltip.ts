import { useRef, useCallback, useEffect } from 'react';

/**
 * Hook for managing cursor tooltip functionality.
 * Handles tooltip display, inserter hover detection, and row editing state.
 */
export function useCursorTooltip(nodesCount: number) {
  const cursorTooltipRef = useRef<HTMLDivElement | null>(null);
  const cursorIconRef = useRef<HTMLDivElement | null>(null);

  // Initialize tooltip DOM elements
  useEffect(() => {
    const el = document.createElement('div');
    el.style.position = 'fixed';
    el.style.pointerEvents = 'none';
    el.style.zIndex = '9999';
    el.style.fontSize = '12px';
    el.style.padding = '2px 6px';
    el.style.border = '1px solid #eab308';
    el.style.background = '#fef9c3';
    el.style.color = '#0f172a';
    el.style.borderRadius = '6px';
    el.style.boxShadow = '0 2px 6px rgba(0,0,0,0.15)';
    el.style.display = 'none';
    document.body.appendChild(el);
    cursorTooltipRef.current = el;

    const icon = document.createElement('div');
    icon.style.position = 'fixed';
    icon.style.pointerEvents = 'none';
    icon.style.zIndex = '10000';
    icon.style.width = '14px';
    icon.style.height = '14px';
    icon.style.borderRadius = '50%';
    icon.style.background = '#0ea5e9';
    icon.style.boxShadow = '0 0 0 2px #bae6fd';
    icon.style.display = 'none';
    document.body.appendChild(icon);
    cursorIconRef.current = icon;

    return () => {
      if (cursorTooltipRef.current?.parentNode) {
        cursorTooltipRef.current.parentNode.removeChild(cursorTooltipRef.current);
      }
      if (cursorIconRef.current?.parentNode) {
        cursorIconRef.current.parentNode.removeChild(cursorIconRef.current);
      }
      cursorTooltipRef.current = null;
      cursorIconRef.current = null;
    };
  }, []);

  const setCursorTooltip = useCallback((text: string | null, x?: number, y?: number) => {
    const el = cursorTooltipRef.current;
    const icon = cursorIconRef.current;
    if (!el) return;
    if (!text) {
      el.style.display = 'none';
      if (icon) icon.style.display = 'none';
      return;
    }
    el.textContent = text;
    if (typeof x === 'number' && typeof y === 'number') {
      el.style.left = `${x + 12}px`;
      el.style.top = `${y + 12}px`;
      if (icon) {
        icon.style.left = `${x + 2}px`;
        icon.style.top = `${y + 2}px`;
      }
    }
    el.style.display = 'block';
    if (icon) icon.style.display = 'block';
  }, []);

  // Helper to check if a row is in editing state
  const checkIfRowEditing = useCallback(() => {
    const activeElement = document.activeElement;
    const isTextInputFocused =
      activeElement?.tagName === 'TEXTAREA' || activeElement?.tagName === 'INPUT';

    // Exclude intellisense standalone input (not a row in editing)
    const isIntellisenseInput =
      activeElement?.closest('.intellisense-menu-standalone') !== null ||
      activeElement?.closest('.intellisense-standalone-wrapper') !== null;

    // Check if there's a textarea/input with focus that is NOT intellisense
    const focusedTextarea = document.querySelector('textarea:focus');
    const focusedInput = document.querySelector('input:focus');
    const isFocusedTextareaIntellisense =
      focusedTextarea?.closest('.intellisense-menu-standalone') !== null ||
      focusedTextarea?.closest('.intellisense-standalone-wrapper') !== null;
    const isFocusedInputIntellisense =
      focusedInput?.closest('.intellisense-menu-standalone') !== null ||
      focusedInput?.closest('.intellisense-standalone-wrapper') !== null;

    // There's a row in editing if:
    // 1. There's a textarea/input with focus that is NOT intellisense
    // 2. There's an element with data-row-id (row in editing)
    const hasRowInEditing = document.querySelector('[data-row-id]') !== null;

    return (
      (isTextInputFocused && !isIntellisenseInput) ||
      (focusedTextarea !== null && !isFocusedTextareaIntellisense) ||
      (focusedInput !== null && !isFocusedInputIntellisense) ||
      hasRowInEditing
    );
  }, []);

  // Hide tooltip when first node is created
  useEffect(() => {
    if (nodesCount > 0) {
      setCursorTooltip(null);
    }
  }, [nodesCount, setCursorTooltip]);

  // Hide tooltip when a row enters editing (focus/blur)
  useEffect(() => {
    const onFocus = () => {
      if (checkIfRowEditing()) {
        setCursorTooltip(null);
      }
    };

    const onBlur = () => {
      // Do nothing on blur, mousemove will handle it
    };

    document.addEventListener('focusin', onFocus, true);
    document.addEventListener('focusout', onBlur, true);

    return () => {
      document.removeEventListener('focusin', onFocus, true);
      document.removeEventListener('focusout', onBlur, true);
    };
  }, [checkIfRowEditing, setCursorTooltip]);

  // Inserter hover: custom cursor + label
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      const isInserter =
        el?.classList?.contains('row-inserter') || !!el?.closest?.('.row-inserter');

      // Disable tooltip during row drag
      const isDraggingRow = document.querySelector(
        '.node-row-outer[data-being-dragged="true"]'
      );

      // Disable also if there's a dragged element
      const isDraggedElement = document.querySelector('[key*="dragged-"]');

      // Check if there's a row in editing
      const isRowEditing = checkIfRowEditing();

      if (isInserter && !isDraggingRow && !isDraggedElement && !isRowEditing) {
        setCursorTooltip('Click to insert here...', e.clientX, e.clientY);
      } else {
        // Hide only if this effect showed the message
        try {
          const txt = cursorTooltipRef.current?.textContent || '';
          if (txt === 'Click to insert here...') setCursorTooltip(null);
        } catch {
          // Ignore errors
        }
      }
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove as any);
  }, [setCursorTooltip, checkIfRowEditing]);

  return { setCursorTooltip };
}
