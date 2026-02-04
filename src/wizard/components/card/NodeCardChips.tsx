// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Node Card Chips Component
 *
 * Displays status chips for STEP 1-7 pipeline progress.
 * Shows real-time status for each step.
 */

import React from 'react';
import StatusChip, { ChipStatus } from '../common/StatusChip';
import type { NodePipelineProgress, PipelineStep } from '../../types/pipeline.types';

interface NodeCardChipsProps {
  nodeId: string;
  progress?: NodePipelineProgress;
  onChipClick?: (step: PipelineStep) => void;
  compact?: boolean;
}

const stepLabels: Record<PipelineStep, string> = {
  'contract-refinement': 'Contract',
  'canonical-values': 'Canonical',
  'constraints': 'Constraints',
  'engines': 'Engines',
  'escalation': 'Escalation',
  'test-examples': 'Tests',
  'ai-messages': 'Messages'
};

export default function NodeCardChips({ nodeId, progress, onChipClick, compact = false }: NodeCardChipsProps) {
  if (!progress) {
    // No progress yet - show all pending
    return (
      <div className="flex flex-wrap gap-1">
        {Object.keys(stepLabels).map((step) => (
          <StatusChip
            key={step}
            status="pending"
            label={compact ? undefined : stepLabels[step as PipelineStep]}
            size={compact ? 'sm' : 'md'}
          />
        ))}
      </div>
    );
  }

  const getChipStatus = (step: PipelineStep): ChipStatus => {
    const stepProgress = progress.steps[step];
    if (!stepProgress) return 'pending';
    return stepProgress.status as ChipStatus;
  };

  return (
    <div className="flex flex-wrap gap-1">
      {(Object.keys(stepLabels) as PipelineStep[]).map((step) => {
        const status = getChipStatus(step);
        const stepProgress = progress.steps[step];
        const label = compact ? undefined : stepLabels[step];
        const tooltip = stepProgress?.message || stepLabels[step];

        return (
          <div
            key={step}
            onClick={() => onChipClick?.(step)}
            style={{ cursor: onChipClick ? 'pointer' : 'default' }}
            title={tooltip}
          >
            <StatusChip
              status={status}
              label={label}
              size={compact ? 'sm' : 'md'}
            />
          </div>
        );
      })}
    </div>
  );
}
