// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Wizard State Management
 *
 * Pure functions for managing wizard global state.
 * No side effects, no React dependencies.
 */

import type { WizardState, WizardPhase, SchemaNode } from '../types/wizard.types';
import type { NodePipelineProgress, NodeGenerationResult } from '../types/pipeline.types';

/**
 * Create initial wizard state
 */
export function createInitialWizardState(rootLabel: string = 'Data'): WizardState {
  return {
    phase: 'template-search',
    structure: [],
    rootLabel,
    templateFound: false,
    iterationCount: 0,
    pipelineProgress: new Map(),
    generatedArtifacts: new Map()
  };
}

/**
 * Set wizard phase
 */
export function setPhase(state: WizardState, phase: WizardPhase): WizardState {
  return {
    ...state,
    phase
  };
}

/**
 * Update structure data
 */
export function updateStructure(state: WizardState, structure: SchemaNode[]): WizardState {
  return {
    ...state,
    structure
  };
}

/**
 * Set root label
 */
export function setRootLabel(state: WizardState, rootLabel: string): WizardState {
  return {
    ...state,
    rootLabel
  };
}

/**
 * Set template found status
 */
export function setTemplateFound(state: WizardState, templateFound: boolean, templateMatch?: any): WizardState {
  return {
    ...state,
    templateFound,
    templateMatch: templateMatch || state.templateMatch
  };
}

/**
 * Set iteration feedback
 */
export function setIterationFeedback(state: WizardState, feedback: string): WizardState {
  return {
    ...state,
    iterationFeedback: feedback,
    iterationCount: state.iterationCount + 1
  };
}

/**
 * Update pipeline progress for a node
 */
export function updatePipelineProgress(
  state: WizardState,
  nodeId: string,
  progress: NodePipelineProgress
): WizardState {
  const newProgress = new Map(state.pipelineProgress);
  newProgress.set(nodeId, progress);
  return {
    ...state,
    pipelineProgress: newProgress
  };
}

/**
 * Set generation result for a node
 */
export function setGenerationResult(
  state: WizardState,
  nodeId: string,
  result: NodeGenerationResult
): WizardState {
  const newArtifacts = new Map(state.generatedArtifacts);
  newArtifacts.set(nodeId, result);
  return {
    ...state,
    generatedArtifacts: newArtifacts
  };
}

/**
 * Check if wizard can proceed to next phase
 */
export function canProceedToNextPhase(state: WizardState, targetPhase: WizardPhase): boolean {
  switch (targetPhase) {
    case 'structure-proposal':
      return state.phase === 'template-search' && !state.templateFound;
    case 'iteration':
      return state.phase === 'structure-proposal';
    case 'mode-selection':
      return state.phase === 'structure-proposal' || state.phase === 'iteration';
    case 'pipeline':
      return state.phase === 'mode-selection' && state.structure.length > 0;
    case 'complete':
      return state.phase === 'pipeline' || state.phase === 'mode-selection';
    default:
      return false;
  }
}
