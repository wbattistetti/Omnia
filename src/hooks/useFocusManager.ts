import { useState, useCallback, useRef } from 'react';

export interface FocusState {
  active: { nodeId?: string; rowId?: string } | null;
  focusBump: number;
}

export interface FocusActions {
  setFocus: (focus: { nodeId: string; rowId: string } | { nodeId: string; rowId: null } | null) => void;
  clearFocus: () => void;
}

export interface FocusEvents {
  onCanvasClick: () => void;
}

export interface UseFocusManagerReturn {
  focusState: FocusState;
  focusActions: FocusActions;
  focusEvents: FocusEvents;
}

export const useFocusManager = (): UseFocusManagerReturn => {
  const [active, setActive] = useState<{ nodeId?: string; rowId?: string } | null>(null);
  const focusBumpRef = useRef(0);

  const setFocusWithLog = useCallback((focus: { nodeId: string; rowId: string } | { nodeId: string; rowId: null } | null) => {
    setActive(focus);
    focusBumpRef.current = (focusBumpRef.current + 1) % 1000;
  }, []);

  const focusActions: FocusActions = {
    setFocus: setFocusWithLog,
    
    clearFocus: useCallback(() => {
      setActive(null);
      focusBumpRef.current = (focusBumpRef.current + 1) % 1000;
    }, [])
  };

  const focusEvents: FocusEvents = {
    onCanvasClick: useCallback(() => {
      setActive(null);
      focusBumpRef.current = (focusBumpRef.current + 1) % 1000;
    }, [])
  };

  const focusState: FocusState = {
    active,
    focusBump: focusBumpRef.current
  };

  return {
    focusState,
    focusActions,
    focusEvents
  };
};