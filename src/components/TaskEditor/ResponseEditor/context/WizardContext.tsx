// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React, { createContext, useContext, useMemo } from 'react';
import { WizardMode } from '../../../../../TaskBuilderAIWizard/types/WizardMode';
import type { WizardTaskTreeNode } from '../../../../../TaskBuilderAIWizard/types';
import type { PipelineStep } from '../../../../../TaskBuilderAIWizard/store/wizardStore';
import type { UseWizardResult } from '../../../../../TaskBuilderAIWizard/hooks/useWizard';

export interface WizardContextValue {
  // Wizard state (always available when wizard is active)
  wizardMode: WizardMode;
  runMode: 'none' | 'full' | 'adaptation'; // ✅ NEW: Single source of truth for run mode
  currentStep: string; // DEPRECATED but kept for compatibility
  dataSchema: WizardTaskTreeNode[];
  pipelineSteps: PipelineStep[];

  // Wizard state flags
  showStructureConfirmation: boolean;
  structureConfirmed: boolean;
  showCorrectionMode: boolean;
  correctionInput: string;
  setCorrectionInput: (value: string) => void;

  /** Wizard output: whether to offer Factory publish; labels/messages for that flow. */
  shouldBeGeneral: boolean;
  generalizedLabel: string | null;
  generalizedMessages: string[] | null;
  generalizationReason: string | null;

  // Wizard handlers
  handleStructureConfirm: () => Promise<void>;
  handleStructureReject: () => void;
  runGenerationPipeline: (taskLabel: string, taskId?: string) => Promise<void>; // @deprecated
  handleCorrectionSubmit: () => Promise<void>;

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

  // ✅ NEW: Phase counters (source of truth for progress)
  phaseCounters?: {
    constraints: { completed: number; total: number };
    parsers: { completed: number; total: number };
    messages: { completed: number; total: number };
  };
}

/**
 * Helper to convert UseWizardResult to WizardContextValue
 */
export function wizardResultToContextValue(wizard: UseWizardResult): WizardContextValue {
  return {
    wizardMode: wizard.wizardMode,
    runMode: wizard.runMode,
    currentStep: wizard.currentStep,
    dataSchema: wizard.dataSchema || [],
    pipelineSteps: wizard.pipelineSteps || [], // ✅ Default to empty array to prevent undefined errors
    showStructureConfirmation: wizard.showStructureConfirmation,
    structureConfirmed: wizard.structureConfirmed,
    showCorrectionMode: wizard.showCorrectionMode,
    correctionInput: wizard.correctionInput,
    setCorrectionInput: wizard.setCorrectionInput,
    shouldBeGeneral: wizard.shouldBeGeneral,
    generalizedLabel: wizard.generalizedLabel,
    generalizedMessages: wizard.generalizedMessages,
    generalizationReason: wizard.generalizationReason,
    handleStructureConfirm: wizard.confirmStructure,
    handleStructureReject: wizard.rejectStructure,
    runGenerationPipeline: wizard.startFull, // @deprecated - use startFull directly
    handleCorrectionSubmit: wizard.handleCorrectionSubmit,
    onProceedFromEuristica: wizard.onProceedFromEuristica,
    onShowModuleList: wizard.onShowModuleList,
    onSelectModule: wizard.onSelectModule,
    onPreviewModule: wizard.onPreviewModule,
    availableModules: wizard.availableModules,
    foundModuleId: wizard.foundModuleId,
    currentParserSubstep: wizard.currentParserSubstep,
    currentMessageSubstep: wizard.currentMessageSubstep,
    phaseCounters: wizard.phaseCounters,
  };
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
