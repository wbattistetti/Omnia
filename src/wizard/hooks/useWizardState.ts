// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * useWizardState Hook
 *
 * Manages global wizard state and phase transitions.
 * Provides state management for the entire wizard flow.
 */

import { useState, useCallback } from 'react';
import type { WizardState, WizardPhase, SchemaNode } from '../types/wizard.types';
import type { NodePipelineProgress, NodeGenerationResult } from '../types/pipeline.types';
import {
  createInitialWizardState,
  setPhase,
  updateStructure,
  setRootLabel,
  setTemplateFound,
  setIterationFeedback,
  updatePipelineProgress,
  setGenerationResult,
  canProceedToNextPhase
} from '../state/wizardState';

export function useWizardState(initialRootLabel: string = 'Data') {
  const [state, setState] = useState<WizardState>(() =>
    createInitialWizardState(initialRootLabel)
  );

  const changePhase = useCallback((phase: WizardPhase) => {
    if (canProceedToNextPhase(state, phase)) {
      setState(prev => setPhase(prev, phase));
    } else {
      console.warn(`[useWizardState] Cannot proceed to phase ${phase} from ${state.phase}`);
    }
  }, [state]);

  const updateStructureData = useCallback((structure: SchemaNode[]) => {
    setState(prev => updateStructure(prev, structure));
  }, []);

  const changeRootLabel = useCallback((rootLabel: string) => {
    setState(prev => setRootLabel(prev, rootLabel));
  }, []);

  const markTemplateFound = useCallback((templateMatch?: any) => {
    setState(prev => setTemplateFound(prev, true, templateMatch));
  }, []);

  const markTemplateNotFound = useCallback(() => {
    setState(prev => setTemplateFound(prev, false));
  }, []);

  const setFeedback = useCallback((feedback: string) => {
    setState(prev => setIterationFeedback(prev, feedback));
  }, []);

  const updateNodeProgress = useCallback((nodeId: string, progress: NodePipelineProgress) => {
    setState(prev => updatePipelineProgress(prev, nodeId, progress));
  }, []);

  const setNodeResult = useCallback((nodeId: string, result: NodeGenerationResult) => {
    setState(prev => setGenerationResult(prev, nodeId, result));
  }, []);

  return {
    state,
    changePhase,
    updateStructureData,
    changeRootLabel,
    markTemplateFound,
    markTemplateNotFound,
    setFeedback,
    updateNodeProgress,
    setNodeResult
  };
}
