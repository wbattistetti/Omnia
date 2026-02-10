// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React, { createContext, useContext } from 'react';
import { WizardMode } from '../../../../../TaskBuilderAIWizard/types/WizardMode';
import type { WizardTaskTreeNode } from '../../../../../TaskBuilderAIWizard/types';
import type { PipelineStep } from '../../../../../TaskBuilderAIWizard/hooks/useWizardState';

export interface WizardContextValue {
  // Wizard state (always available when wizard is active)
  wizardMode: WizardMode;
  currentStep: string; // DEPRECATED but kept for compatibility
  dataSchema: WizardTaskTreeNode[];
  pipelineSteps: PipelineStep[];

  // Wizard state flags
  showStructureConfirmation: boolean;
  structureConfirmed: boolean;
  showCorrectionMode: boolean;
  correctionInput: string;
  setCorrectionInput: (value: string) => void;

  // Generalization state
  shouldBeGeneral: boolean;
  generalizedLabel: string | null;
  generalizedMessages: string[] | null;
  generalizationReason: string | null;

  // Wizard handlers
  handleStructureConfirm: () => Promise<void>;
  handleStructureReject: () => void;
  runGenerationPipeline: (taskLabel: string, taskId?: string) => Promise<void>;

  // Wizard module handlers
  onProceedFromEuristica: () => Promise<void>;
  onShowModuleList: () => void;
  onSelectModule: (moduleId: string) => Promise<void>;
  onPreviewModule: (moduleId: string | null) => void;
  availableModules: any[];
  foundModuleId: string | undefined;

  // Sotto-stati per parte variabile dinamica
  currentParserSubstep: string | null;
  currentMessageSubstep: string | null;
}

export const WizardContext = createContext<WizardContextValue | null>(null);

/**
 * Hook to access Wizard context.
 * Returns null if wizard is not active (no error thrown).
 */
export function useWizardContext(): WizardContextValue | null {
  return useContext(WizardContext);
}

/**
 * Hook to access Wizard context (throws error if not available).
 * Use this when wizard context is required.
 */
export function useWizardContextRequired(): WizardContextValue {
  const context = useContext(WizardContext);
  if (!context) {
    throw new Error('useWizardContextRequired must be used within WizardContext.Provider and when wizard is active');
  }
  return context;
}
