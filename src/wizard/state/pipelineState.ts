// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Pipeline State Management
 *
 * Pure functions for managing pipeline progress state.
 * No side effects, no React dependencies.
 */

import type { NodePipelineProgress, PipelineStep, StepStatus, StepProgress } from '../types/pipeline.types';

/**
 * Create initial pipeline progress for a node
 */
export function createInitialPipelineProgress(
  nodeId: string,
  nodeLabel: string
): NodePipelineProgress {
  const steps: Record<PipelineStep, StepProgress> = {
    'contract-refinement': { step: 'contract-refinement', status: 'pending' },
    'canonical-values': { step: 'canonical-values', status: 'pending' },
    'constraints': { step: 'constraints', status: 'pending' },
    'engines': { step: 'engines', status: 'pending' },
    'escalation': { step: 'escalation', status: 'pending' },
    'test-examples': { step: 'test-examples', status: 'pending' },
    'ai-messages': { step: 'ai-messages', status: 'pending' }
  };

  return {
    nodeId,
    nodeLabel,
    steps,
    percentage: 0,
    startedAt: new Date()
  };
}

/**
 * Update step status
 */
export function updateStepStatus(
  progress: NodePipelineProgress,
  step: PipelineStep,
  status: StepStatus,
  message?: string,
  error?: string
): NodePipelineProgress {
  const updatedSteps = {
    ...progress.steps,
    [step]: {
      ...progress.steps[step],
      status,
      message,
      error,
      timestamp: new Date()
    }
  };

  return {
    ...progress,
    steps: updatedSteps,
    currentStep: status === 'processing' ? step : progress.currentStep,
    currentAction: message || progress.currentAction,
    error: error || progress.error
  };
}

/**
 * Update step percentage
 */
export function updateStepPercentage(
  progress: NodePipelineProgress,
  step: PipelineStep,
  percentage: number
): NodePipelineProgress {
  const updatedSteps = {
    ...progress.steps,
    [step]: {
      ...progress.steps[step],
      percentage
    }
  };

  return {
    ...progress,
    steps: updatedSteps
  };
}

/**
 * Calculate overall percentage
 */
export function calculateOverallPercentage(progress: NodePipelineProgress): number {
  const stepCount = Object.keys(progress.steps).length;
  const stepValues: number[] = [];

  for (const step of Object.values(progress.steps)) {
    if (step.status === 'completed') {
      stepValues.push(100);
    } else if (step.status === 'processing') {
      stepValues.push(step.percentage || 0);
    } else if (step.status === 'error') {
      stepValues.push(0);
    } else {
      stepValues.push(0);
    }
  }

  const total = stepValues.reduce((sum, val) => sum + val, 0);
  return Math.round(total / stepCount);
}

/**
 * Update overall percentage
 */
export function updateOverallPercentage(progress: NodePipelineProgress): NodePipelineProgress {
  const percentage = calculateOverallPercentage(progress);
  return {
    ...progress,
    percentage,
    completedAt: percentage >= 100 ? new Date() : progress.completedAt
  };
}

/**
 * Check if pipeline is complete
 */
export function isPipelineComplete(progress: NodePipelineProgress): boolean {
  return Object.values(progress.steps).every(
    step => step.status === 'completed' || step.status === 'skipped' || step.status === 'manual'
  );
}

/**
 * Check if pipeline has errors
 */
export function hasPipelineErrors(progress: NodePipelineProgress): boolean {
  return Object.values(progress.steps).some(step => step.status === 'error');
}
