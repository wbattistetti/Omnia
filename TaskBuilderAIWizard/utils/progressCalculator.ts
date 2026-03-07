// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Progress Calculator
 *
 * Single source of truth for progress calculation across the wizard.
 * Centralizes all progress calculation logic to eliminate duplication.
 */

import type { PipelineStep } from '../store/wizardStore';
import type { WizardTaskTreeNode } from '../types';
import { flattenTaskTree } from './wizardHelpers';

export interface PhaseCounters {
  constraints: { completed: number; total: number };
  parsers: { completed: number; total: number };
  messages: { completed: number; total: number };
}

/**
 * Calculates progress percentage for a phase based on REAL COUNTERS (source of truth)
 * Falls back to payload extraction if counters not available (backward compatibility)
 *
 * @param phase - The phase to calculate progress for
 * @param pipelineSteps - Array of pipeline steps (for fallback)
 * @param phaseCounters - Real counters from store (source of truth)
 * @returns Progress percentage (0-100)
 */
export function calculatePhaseProgress(
  phase: 'constraints' | 'parser' | 'messages',
  pipelineSteps: PipelineStep[],
  phaseCounters?: PhaseCounters
): number {
  // ✅ PRIMARY: Use real counters if available (source of truth)
  if (phaseCounters) {
    const counter = phase === 'constraints' ? phaseCounters.constraints
                  : phase === 'parser' ? phaseCounters.parsers
                  : phaseCounters.messages;

    if (counter.total > 0) {
      const progress = Math.round((counter.completed / counter.total) * 100);
      return Math.min(100, Math.max(0, progress)); // Clamp to 0-100
    }
  }

  // Fallback: extract from payload (for backward compatibility)
  const phaseId = phase === 'constraints' ? 'constraints'
               : phase === 'parser' ? 'parsers'
               : 'messages';

  const step = pipelineSteps.find(s => s.id === phaseId);

  if (!step) {
    return 0;
  }

  // If phase is completed, return 100%
  if (step.status === 'completed') {
    return 100;
  }

  // If phase is running, extract percentage from payload
  if (step.status === 'running' && step.payload) {
    // Payload is a string like "33%" or a dynamic message with percentage
    // Try to match percentage anywhere in the string (not just at end)
    const match = step.payload.match(/(\d+)%/);
    if (match) {
      const progress = parseInt(match[1], 10);
      return Math.min(100, Math.max(0, progress)); // Clamp to 0-100
    } else {
      // If no percentage found, return 0% so progress bar shows at 0%
      return 0;
    }
  }

  // Default: 0%
  return 0;
}

/**
 * Calculates progress percentage for a phase based on individual task progress
 * This is an alternative calculation method that averages progress across all tasks
 *
 * @param phase - The phase to calculate progress for
 * @param dataSchema - The wizard task tree nodes
 * @returns Progress percentage (0-100)
 */
export function calculatePhaseProgressFromTasks(
  phase: 'constraints' | 'parser' | 'messages',
  dataSchema: WizardTaskTreeNode[]
): number {
  const allTasks = flattenTaskTree(dataSchema);
  if (allTasks.length === 0) return 0;

  const progressField = phase === 'constraints' ? 'constraintsProgress'
                     : phase === 'parser' ? 'parserProgress'
                     : 'messagesProgress';
  const stateField = phase === 'constraints' ? 'constraints'
                  : phase === 'parser' ? 'parser'
                  : 'messages';

  const progresses = allTasks.map(task => {
    const state = task.pipelineStatus?.[stateField] || 'pending';
    if (state === 'pending') return 0;
    if (state === 'completed') return 100;
    return task.pipelineStatus?.[progressField] || 0;
  });

  const total = progresses.reduce((sum, p) => sum + p, 0);
  const average = Math.round(total / allTasks.length);
  return Math.min(100, Math.max(0, average)); // Clamp to 0-100
}

/**
 * Gets the preferred progress calculation method
 * Uses phaseCounters if available (more accurate), otherwise falls back to task-based calculation
 *
 * @param phase - The phase to calculate progress for
 * @param pipelineSteps - Array of pipeline steps (for fallback)
 * @param phaseCounters - Real counters from store (preferred)
 * @param dataSchema - The wizard task tree nodes (fallback)
 * @returns Progress percentage (0-100)
 */
export function getPhaseProgress(
  phase: 'constraints' | 'parser' | 'messages',
  pipelineSteps: PipelineStep[],
  phaseCounters?: PhaseCounters,
  dataSchema?: WizardTaskTreeNode[]
): number {
  // Try phaseCounters first (most accurate)
  if (phaseCounters) {
    const progress = calculatePhaseProgress(phase, pipelineSteps, phaseCounters);
    if (progress > 0 || phaseCounters[phase === 'constraints' ? 'constraints' : phase === 'parser' ? 'parsers' : 'messages'].total > 0) {
      return progress;
    }
  }

  // Fallback to task-based calculation if dataSchema available
  if (dataSchema && dataSchema.length > 0) {
    return calculatePhaseProgressFromTasks(phase, dataSchema);
  }

  // Final fallback: extract from pipeline step payload
  return calculatePhaseProgress(phase, pipelineSteps, phaseCounters);
}
