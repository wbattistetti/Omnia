// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Node Card Progress Component
 *
 * Displays real-time progress for STEP 1-7 pipeline.
 * Format: "Label: ✔️ Contract   ✔️ Constraints   sto creando i messaggi..."
 */

import React from 'react';
import type { NodePipelineProgress, PipelineStep } from '../../types/pipeline.types';

interface NodeCardProgressProps {
  nodeLabel: string;
  progress?: NodePipelineProgress;
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

const stepOrder: PipelineStep[] = [
  'contract-refinement',
  'canonical-values',
  'constraints',
  'engines',
  'escalation',
  'test-examples',
  'ai-messages'
];

export default function NodeCardProgress({ nodeLabel, progress }: NodeCardProgressProps) {
  if (!progress) {
    return (
      <div className="text-sm text-gray-400">
        {nodeLabel}: waiting...
      </div>
    );
  }

  const parts: string[] = [];

  for (const step of stepOrder) {
    const stepProgress = progress.steps[step];
    if (!stepProgress) continue;

    if (stepProgress.status === 'completed') {
      parts.push(`✔️ ${stepLabels[step]}`);
    } else if (stepProgress.status === 'processing') {
      const message = stepProgress.message || `creating ${stepLabels[step]}...`;
      parts.push(`⏳ ${message}`);
      break; // Stop at first processing step
    } else if (stepProgress.status === 'manual') {
      parts.push(`✏️ ${stepLabels[step]}`);
    } else if (stepProgress.status === 'error') {
      parts.push(`❌ ${stepLabels[step]}`);
      break; // Stop at error
    }
  }

  if (parts.length === 0) {
    return (
      <div className="text-sm text-gray-400">
        {nodeLabel}: pending...
      </div>
    );
  }

  return (
    <div className="text-sm text-gray-300">
      <span className="font-semibold">{nodeLabel}:</span>{' '}
      <span>{parts.join('   ')}</span>
    </div>
  );
}
