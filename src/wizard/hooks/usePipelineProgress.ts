// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * usePipelineProgress Hook
 *
 * Manages pipeline progress tracking for nodes.
 * Provides real-time progress updates and status management.
 */

import { useState, useCallback, useEffect } from 'react';
import type { NodePipelineProgress, PipelineStep, StepStatus } from '../types/pipeline.types';
import {
  createInitialPipelineProgress,
  updateStepStatus,
  updateStepPercentage,
  updateOverallPercentage,
  isPipelineComplete,
  hasPipelineErrors
} from '../state/pipelineState';

export function usePipelineProgress(
  nodeId: string,
  nodeLabel: string,
  onProgressUpdate?: (progress: NodePipelineProgress) => void
) {
  const [progress, setProgress] = useState<NodePipelineProgress>(() =>
    createInitialPipelineProgress(nodeId, nodeLabel)
  );

  const updateStep = useCallback((
    step: PipelineStep,
    status: StepStatus,
    message?: string,
    error?: string
  ) => {
    setProgress(prev => {
      const updated = updateStepStatus(prev, step, status, message, error);
      const final = updateOverallPercentage(updated);
      onProgressUpdate?.(final);
      return final;
    });
  }, [onProgressUpdate]);

  const updatePercentage = useCallback((step: PipelineStep, percentage: number) => {
    setProgress(prev => {
      const updated = updateStepPercentage(prev, step, percentage);
      const final = updateOverallPercentage(updated);
      onProgressUpdate?.(final);
      return final;
    });
  }, [onProgressUpdate]);

  const reset = useCallback(() => {
    const newProgress = createInitialPipelineProgress(nodeId, nodeLabel);
    setProgress(newProgress);
    onProgressUpdate?.(newProgress);
  }, [nodeId, nodeLabel, onProgressUpdate]);

  const isComplete = isPipelineComplete(progress);
  const hasErrors = hasPipelineErrors(progress);

  return {
    progress,
    updateStep,
    updatePercentage,
    reset,
    isComplete,
    hasErrors
  };
}
