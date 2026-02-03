// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useCallback } from 'react';
import type { RightPanelMode } from '../RightPanel';

export interface UsePanelModesParams {
  setLeftPanelMode: React.Dispatch<React.SetStateAction<RightPanelMode>>;
  setTestPanelMode: React.Dispatch<React.SetStateAction<RightPanelMode>>;
  setTasksPanelMode: React.Dispatch<React.SetStateAction<RightPanelMode>>;
}

export interface UsePanelModesResult {
  saveLeftPanelMode: (m: RightPanelMode) => void;
  saveTestPanelMode: (m: RightPanelMode) => void;
  saveTasksPanelMode: (m: RightPanelMode) => void;
  saveRightMode: (m: RightPanelMode) => void;
}

/**
 * Hook that manages panel mode handlers with localStorage persistence.
 */
export function usePanelModes(params: UsePanelModesParams): UsePanelModesResult {
  const { setLeftPanelMode, setTestPanelMode, setTasksPanelMode } = params;

  const saveLeftPanelMode = useCallback((m: RightPanelMode) => {
    setLeftPanelMode(m);
    try { localStorage.setItem('responseEditor.leftPanelMode', m); } catch { }
  }, [setLeftPanelMode]);

  const saveTestPanelMode = useCallback((m: RightPanelMode) => {
    setTestPanelMode(m);
    try { localStorage.setItem('responseEditor.testPanelMode', m); } catch { }
  }, [setTestPanelMode]);

  const saveTasksPanelMode = useCallback((m: RightPanelMode) => {
    setTasksPanelMode(m);
    try { localStorage.setItem('responseEditor.tasksPanelMode', m); } catch { }
  }, [setTasksPanelMode]);

  // Mantieni saveRightMode per compatibilità (gestisce entrambi i pannelli)
  const saveRightMode = useCallback((m: RightPanelMode) => {
    if (m === 'chat') {
      // Se è 'chat', gestisci solo Test
      saveTestPanelMode(m);
    } else if (m === 'none') {
      // Se è 'none', chiudi solo il pannello sinistro (non Test)
      saveLeftPanelMode(m);
    } else {
      // Altrimenti, gestisci solo il pannello sinistro
      saveLeftPanelMode(m);
    }
  }, [saveLeftPanelMode, saveTestPanelMode]);

  return {
    saveLeftPanelMode,
    saveTestPanelMode,
    saveTasksPanelMode,
    saveRightMode,
  };
}
