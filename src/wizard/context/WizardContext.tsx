// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Wizard Context
 *
 * Provides shared state and actions to all wizard components.
 * Reduces prop drilling and coupling.
 */

import React, { createContext, useContext, useCallback, ReactNode } from 'react';
import type { SchemaNode } from '../types/wizard.types';
import type { NodePipelineProgress, NodeGenerationResult } from '../types/pipeline.types';

interface WizardContextValue {
  // Structure management
  structure: SchemaNode[];
  updateNode: (nodeId: string, node: SchemaNode) => void;
  addSubNode: (parentNodeId: string) => void;
  deleteNode: (nodeId: string) => void;

  // Mode management
  setNodeMode: (nodeId: string, mode: 'ai' | 'manual' | 'postponed', propagate?: boolean) => void;

  // Pipeline management
  progressMap: Map<string, NodePipelineProgress>;
  results: Map<string, NodeGenerationResult>;
  updateProgress: (nodeId: string, progress: NodePipelineProgress) => void;
  setResult: (nodeId: string, result: NodeGenerationResult) => void;

  // Actions
  onCompleteAuto: (nodeId: string) => void;
  onEditManual: (nodeId: string) => void;
  onMarkForLater: (nodeId: string) => void;
  onChipClick: (nodeId: string, step: string) => void;
}

const WizardContext = createContext<WizardContextValue | null>(null);

interface WizardContextProviderProps {
  children: ReactNode;
  value: WizardContextValue;
}

/**
 * Wizard Context Provider
 */
export function WizardContextProvider({ children, value }: WizardContextProviderProps) {
  return (
    <WizardContext.Provider value={value}>
      {children}
    </WizardContext.Provider>
  );
}

/**
 * Hook to access wizard context
 *
 * @throws Error if used outside WizardContextProvider
 */
export function useWizardContext(): WizardContextValue {
  const context = useContext(WizardContext);
  if (!context) {
    throw new Error('useWizardContext must be used within WizardContextProvider');
  }
  return context;
}
