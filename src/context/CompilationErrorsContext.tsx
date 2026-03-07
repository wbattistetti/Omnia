// Context for compilation errors
// Provides errors to flowchart components for visualization

import React, { createContext, useContext, useState, useCallback } from 'react';
import type { CompilationError } from '../components/FlowCompiler/types';

interface CompilationErrorsContextValue {
  errors: CompilationError[];
  setErrors: (errors: CompilationError[]) => void;
  clearErrors: () => void;
}

const CompilationErrorsContext = createContext<CompilationErrorsContextValue | undefined>(undefined);

export function CompilationErrorsProvider({ children }: { children: React.ReactNode }) {
  const [errors, setErrors] = useState<CompilationError[]>([]);

  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  // ✅ Sync with window (for useDialogueEngine)
  React.useEffect(() => {
    const checkWindowErrors = () => {
      const windowErrors = (window as any).__compilationErrors;
      if (windowErrors && Array.isArray(windowErrors)) {
        setErrors(windowErrors);
      }
    };

    // Check immediately
    checkWindowErrors();

    // Check periodically (in case errors are set after mount)
    const interval = setInterval(checkWindowErrors, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <CompilationErrorsContext.Provider value={{ errors, setErrors, clearErrors }}>
      {children}
    </CompilationErrorsContext.Provider>
  );
}

export function useCompilationErrors() {
  const context = useContext(CompilationErrorsContext);
  if (!context) {
    // Return empty errors if context not available (backward compatibility)
    return { errors: [], setErrors: () => {}, clearErrors: () => {} };
  }
  return context;
}
