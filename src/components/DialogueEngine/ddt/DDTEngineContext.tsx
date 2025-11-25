// Context for DDT Engine toggle
// Allows components to share the useNewEngine state

import React, { createContext, useContext, useState, useEffect } from 'react';

interface DDTEngineContextType {
  useNewEngine: boolean;
  setUseNewEngine: (value: boolean) => void;
}

const DDTEngineContext = createContext<DDTEngineContextType | undefined>(undefined);

export function DDTEngineProvider({ children }: { children: React.ReactNode }) {
  const [useNewEngine, setUseNewEngineState] = useState(() => {
    try {
      return localStorage.getItem('ddt.useNewEngine') === 'true';
    } catch {
      return false;
    }
  });

  const setUseNewEngine = (value: boolean) => {
    setUseNewEngineState(value);
    try {
      localStorage.setItem('ddt.useNewEngine', value ? 'true' : 'false');
    } catch {
      // Ignore localStorage errors
    }
  };

  return (
    <DDTEngineContext.Provider value={{ useNewEngine, setUseNewEngine }}>
      {children}
    </DDTEngineContext.Provider>
  );
}

export function useDDTEngine() {
  const context = useContext(DDTEngineContext);
  if (context === undefined) {
    // Fallback: read from localStorage directly
    try {
      const useNew = localStorage.getItem('ddt.useNewEngine') === 'true';
      return { useNewEngine: useNew, setUseNewEngine: () => {} };
    } catch {
      return { useNewEngine: false, setUseNewEngine: () => {} };
    }
  }
  return context;
}

