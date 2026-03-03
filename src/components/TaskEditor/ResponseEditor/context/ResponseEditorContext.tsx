// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React, { createContext, useContext } from 'react';
import type { TaskTree, TaskMeta } from '@types/taskTypes';
import type { TaskWizardMode } from '@taskEditor/EditorHost/types';

export interface ResponseEditorContextValue {
  // Global task data (always available)
  taskTree: TaskTree | null | undefined;
  taskMeta: TaskMeta | null;
  taskLabel: string; // Label originale del task (node row label)
  taskId?: string;
  currentProjectId: string | null;

  // Derived data (calculated once)
  headerTitle: string;
  taskType: number;

  // ✅ ARCHITECTURE: Wizard configuration - SINGLE SOURCE OF TRUTH
  // taskWizardMode is managed in Context, not derived locally
  taskWizardMode: TaskWizardMode;
  setTaskWizardMode: (mode: TaskWizardMode) => void;
  contextualizationTemplateId?: string;
}

export const ResponseEditorContext = createContext<ResponseEditorContextValue | null>(null);

/**
 * Hook to access ResponseEditor context.
 * Throws error if used outside provider.
 */
export function useResponseEditorContext(): ResponseEditorContextValue {
  const context = useContext(ResponseEditorContext);
  if (!context) {
    throw new Error('useResponseEditorContext must be used within ResponseEditorContext.Provider');
  }
  return context;
}
