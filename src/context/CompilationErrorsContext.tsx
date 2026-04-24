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

// ✅ Global setter that can be called from anywhere (including async callbacks)
// This allows useDialogueEngine to update errors directly without using window global state
let globalSetErrors: ((errors: CompilationError[]) => void) | null = null;

export function CompilationErrorsProvider({ children }: { children: React.ReactNode }) {
  const [errors, setErrorsState] = useState<CompilationError[]>([]);

  // ✅ Expose setter to global scope for useDialogueEngine
  // This is initialized when the provider mounts
  React.useEffect(() => {
    globalSetErrors = (newErrors: CompilationError[]) => {
      setErrorsState(newErrors);
    };

    return () => {
      globalSetErrors = null;
    };
  }, []);

  // ✅ NEW: Listen for edge error removal requests
  React.useEffect(() => {
    const handler = (e: any) => {
      const d = (e && e.detail) || {};
      const { edgeId } = d;
      if (!edgeId) return;

      // Filter out errors for this edge
      setErrorsState(prev => {
        const filtered = prev.filter(e => e.edgeId !== edgeId);
        if (filtered.length !== prev.length) {
          console.log('[CompilationErrorsContext] ✅ Removed errors for edge', {
            edgeId,
            removedCount: prev.length - filtered.length,
            remainingCount: filtered.length
          });
        }
        return filtered;
      });
    };
    document.addEventListener('compilationErrors:removeEdge', handler as any);
    return () => document.removeEventListener('compilationErrors:removeEdge', handler as any);
  }, []);

  const setErrors = useCallback((newErrors: CompilationError[]) => {
    console.log('[CompilationErrorsContext] ✅ setErrors called:', newErrors.length);
    setErrorsState(newErrors);
  }, []);

  const clearErrors = useCallback(() => {
    setErrorsState([]);
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

// ✅ Export global setter for useDialogueEngine (can be called from async callbacks)
// This function can be called from anywhere, including async functions that can't use hooks
export function setCompilationErrorsGlobal(errors: CompilationError[]): void {
  if (globalSetErrors) {
    globalSetErrors(errors);
  } else {
    // ✅ NO FALLBACK TO WINDOW - errors will be lost if context not initialized
    // This is intentional: the context should always be available in the component tree
    console.error('[CompilationErrorsContext] ❌ Global setter not initialized - errors will be lost. Ensure CompilationErrorsProvider is mounted.');
  }
}

/** Clears flowchart / error-report compilation state (e.g. every time the user hits Run — start() may not run again if the session was already started). */
export function clearCompilationErrorsGlobal(): void {
  setCompilationErrorsGlobal([]);
}
