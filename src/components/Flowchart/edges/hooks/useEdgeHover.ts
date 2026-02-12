import { useState, useRef, useCallback, useEffect } from 'react';

export interface EdgeHoverState {
  hovered: boolean;
  labelHovered: boolean;
  toolbarVisible: boolean;
  trashHovered: boolean;
}

export interface UseEdgeHoverOptions {
  onHoverChange?: (state: EdgeHoverState) => void;
  toolbarTransitionDelay?: number; // ms
}

/**
 * Hook for managing edge hover states with stable toolbar transitions
 * Eliminates flickering and timing issues
 */
export function useEdgeHover(
  options: UseEdgeHoverOptions = {}
): {
  state: EdgeHoverState;
  setHovered: (value: boolean) => void;
  setLabelHovered: (value: boolean) => void;
  setTrashHovered: (value: boolean) => void;
  isToolbarElement: (element: HTMLElement | null) => boolean;
} {
  const { toolbarTransitionDelay = 200, onHoverChange } = options;

  const [hovered, setHovered] = useState(false);
  const [labelHovered, setLabelHoveredState] = useState(false);
  const [trashHovered, setTrashHovered] = useState(false);

  const toolbarTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const toolbarRef = useRef<HTMLElement | null>(null);
  const labelRef = useRef<HTMLElement | null>(null);

  const setLabelHovered = useCallback((value: boolean) => {
    if (value) {
      // Cancel any pending hide
      if (toolbarTimeoutRef.current) {
        clearTimeout(toolbarTimeoutRef.current);
        toolbarTimeoutRef.current = null;
      }
      setLabelHoveredState(true);
    } else {
      // Delay hide to allow transition to toolbar
      if (toolbarTimeoutRef.current) {
        clearTimeout(toolbarTimeoutRef.current);
      }
      toolbarTimeoutRef.current = setTimeout(() => {
        // Check if mouse is still over toolbar or label
        const activeElement = document.elementFromPoint(
          (window as any).__lastMouseX || 0,
          (window as any).__lastMouseY || 0
        ) as HTMLElement;

        const isOverToolbar = activeElement && (
          toolbarRef.current?.contains(activeElement) ||
          labelRef.current?.contains(activeElement)
        );

        if (!isOverToolbar) {
          setLabelHoveredState(false);
        }
        toolbarTimeoutRef.current = null;
      }, toolbarTransitionDelay);
    }
  }, [toolbarTransitionDelay]);

  const isToolbarElement = useCallback((element: HTMLElement | null): boolean => {
    if (!element) return false;
    return !!(
      toolbarRef.current?.contains(element) ||
      labelRef.current?.contains(element)
    );
  }, []);

  const toolbarVisible = labelHovered;

  const state: EdgeHoverState = {
    hovered,
    labelHovered,
    toolbarVisible,
    trashHovered,
  };

  // Notify parent of state changes
  useEffect(() => {
    onHoverChange?.(state);
  }, [state, onHoverChange]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (toolbarTimeoutRef.current) {
        clearTimeout(toolbarTimeoutRef.current);
      }
    };
  }, []);

  return {
    state,
    setHovered,
    setLabelHovered,
    setTrashHovered,
    isToolbarElement,
  };
}

// Export ref setters for components
export function useEdgeHoverRefs() {
  const toolbarRef = useRef<HTMLElement | null>(null);
  const labelRef = useRef<HTMLElement | null>(null);

  return {
    toolbarRef,
    labelRef,
  };
}
