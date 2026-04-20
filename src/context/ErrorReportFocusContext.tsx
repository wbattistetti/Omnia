/**
 * Coordinates focus between flowchart rows and the debugger Error Report cards (scroll + highlight).
 */

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

export type ErrorReportFocusContextValue = {
  focusedDebuggerErrorCardKey: string | null;
  setFocusedDebuggerErrorCardKey: (key: string | null) => void;
  /** Flow row hover → preview matching error card (scroll + lighter ring). Cleared on mouseleave. */
  hoveredDebuggerErrorCardKey: string | null;
  setHoveredDebuggerErrorCardKey: (key: string | null) => void;
};

const ErrorReportFocusContext = createContext<ErrorReportFocusContextValue | undefined>(undefined);

export function ErrorReportFocusProvider({ children }: { children: React.ReactNode }) {
  const [focusedDebuggerErrorCardKey, setFocusedDebuggerErrorCardKeyState] = useState<string | null>(
    null
  );
  const [hoveredDebuggerErrorCardKey, setHoveredDebuggerErrorCardKeyState] = useState<string | null>(
    null
  );

  const setFocusedDebuggerErrorCardKey = useCallback((key: string | null) => {
    setFocusedDebuggerErrorCardKeyState(key);
  }, []);

  const setHoveredDebuggerErrorCardKey = useCallback((key: string | null) => {
    setHoveredDebuggerErrorCardKeyState(key);
  }, []);

  const value = useMemo(
    () => ({
      focusedDebuggerErrorCardKey,
      setFocusedDebuggerErrorCardKey,
      hoveredDebuggerErrorCardKey,
      setHoveredDebuggerErrorCardKey,
    }),
    [
      focusedDebuggerErrorCardKey,
      setFocusedDebuggerErrorCardKey,
      hoveredDebuggerErrorCardKey,
      setHoveredDebuggerErrorCardKey,
    ]
  );

  return (
    <ErrorReportFocusContext.Provider value={value}>{children}</ErrorReportFocusContext.Provider>
  );
}

export function useErrorReportFocus(): ErrorReportFocusContextValue {
  const ctx = useContext(ErrorReportFocusContext);
  if (!ctx) {
    throw new Error('useErrorReportFocus must be used within ErrorReportFocusProvider');
  }
  return ctx;
}

/** Safe when the provider is absent (tests / Storybook). */
export function useErrorReportFocusOptional(): ErrorReportFocusContextValue | undefined {
  return useContext(ErrorReportFocusContext);
}
