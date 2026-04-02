// HeaderToolbarContext
// Provides mechanism for task editors to inject their icon, title, and toolbar into the main header
// Allows dynamic header updates without modifying the main layout
// ✅ ARCHITECTURE: Single source of truth for header content (icon, title, toolbar)

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

export interface HeaderToolbarContextValue {
  // Toolbar injection
  setToolbar: (toolbar: React.ReactNode | null) => void;
  toolbar: React.ReactNode | null;

  // Icon injection
  setIcon: (icon: React.ReactNode | null) => void;
  icon: React.ReactNode | null;

  // Title injection
  setTitle: (title: string | null) => void;
  title: string | null;
}

const HeaderToolbarContext = createContext<HeaderToolbarContextValue | null>(null);

/**
 * Hook to access HeaderToolbarContext
 * Returns null if context is not available (safe for components that may not be within provider)
 */
export function useHeaderToolbarContext(): HeaderToolbarContextValue | null {
  return useContext(HeaderToolbarContext);
}

/**
 * Provider component for HeaderToolbarContext
 * ✅ ARCHITECTURE: Manages all injectable header elements (icon, title, toolbar)
 */
export function HeaderToolbarProvider({ children }: { children: React.ReactNode }) {
  const [toolbar, setToolbarState] = useState<React.ReactNode | null>(null);
  const [icon, setIconState] = useState<React.ReactNode | null>(null);
  const [title, setTitleState] = useState<string | null>(null);

  const setToolbar = useCallback((newToolbar: React.ReactNode | null) => {
    setToolbarState(newToolbar);
  }, []);

  const setIcon = useCallback((newIcon: React.ReactNode | null) => {
    setIconState(newIcon);
  }, []);

  const setTitle = useCallback((newTitle: string | null) => {
    setTitleState(newTitle);
  }, []);

  // Stable reference when toolbar/icon/title unchanged — avoids consumer useEffect loops
  // that list the whole context object in dependency arrays.
  const value = useMemo<HeaderToolbarContextValue>(
    () => ({
      toolbar,
      setToolbar,
      icon,
      setIcon,
      title,
      setTitle,
    }),
    [toolbar, setToolbar, icon, setIcon, title, setTitle]
  );

  return (
    <HeaderToolbarContext.Provider value={value}>
      {children}
    </HeaderToolbarContext.Provider>
  );
}
