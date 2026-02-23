// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Wizard Helper Functions
 *
 * Pure utility functions for wizard calculations and transformations.
 */

import type { PipelineStep } from '../store/wizardStore';
import type { WizardTaskTreeNode } from '../types';

/**
 * Flattens task tree to get all nodes (root + subNodes)
 */
export function flattenTaskTree(nodes: WizardTaskTreeNode[]): WizardTaskTreeNode[] {
  const result: WizardTaskTreeNode[] = [];
  nodes.forEach(node => {
    result.push(node);
    if (node.subNodes && node.subNodes.length > 0) {
      result.push(...flattenTaskTree(node.subNodes));
    }
  });
  return result;
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
  phaseCounters?: {
    constraints: { completed: number; total: number };
    parsers: { completed: number; total: number };
    messages: { completed: number; total: number };
  }
): number {
  // ✅ FIX: Use real counters if available (source of truth)
  if (phaseCounters) {
    const counter = phase === 'constraints' ? phaseCounters.constraints
                  : phase === 'parser' ? phaseCounters.parsers
                  : phaseCounters.messages;

    if (counter.total > 0) {
      const progress = Math.round((counter.completed / counter.total) * 100);
      // ❌ REMOVED: Debug log (was causing spam)
      return progress;
    }
  }

  // Fallback: extract from payload (for backward compatibility)
  const phaseId = phase === 'constraints' ? 'constraints'
               : phase === 'parser' ? 'parsers'
               : 'messages';

  const step = pipelineSteps.find(s => s.id === phaseId);

  if (!step) {
    // ❌ REMOVED: Debug log
    return 0;
  }

  // If phase is completed, return 100%
  if (step.status === 'completed') {
    // ❌ REMOVED: Debug log
    return 100;
  }

  // If phase is running, extract percentage from payload
  if (step.status === 'running' && step.payload) {
    // Payload is a string like "33%" or a dynamic message with percentage
    // ✅ FIX: Handle unicode characters (…, etc.) and match percentage at end or anywhere
    // Try to match percentage anywhere in the string (not just at end)
    const match = step.payload.match(/(\d+)%/);
    if (match) {
      const progress = parseInt(match[1], 10);
      // ❌ REMOVED: Debug log
      return progress;
    } else {
      // ✅ FIX: If no percentage found, return 0% (not undefined) so progress bar shows at 0%
      // ❌ REMOVED: Debug log
      return 0; // ✅ Return 0% instead of undefined so progress bar shows
    }
  }

  // Default: 0%
  // ❌ REMOVED: Debug log
  return 0;
}

/**
 * Gets the state of a phase based on pipeline step
 *
 * @param pipelineStep - The pipeline step to check
 * @returns Phase state: 'pending' | 'running' | 'completed'
 */
export function getPhaseState(pipelineStep: PipelineStep): 'pending' | 'running' | 'completed' {
  if (pipelineStep.status === 'completed') {
    return 'completed';
  }
  if (pipelineStep.status === 'running') {
    return 'running';
  }
  return 'pending';
}

/**
 * Extracts dynamic message from pipeline step payload (removes percentage)
 *
 * @param step - The pipeline step
 * @returns Dynamic message without percentage, or undefined
 */
export function extractDynamicMessage(step: PipelineStep | undefined): string | undefined {
  if (!step) {
    return undefined;
  }

  if (step.status === 'running' && step.payload) {
    // Extract message removing final percentage (e.g., "Sto generando... 33%" -> "Sto generando...")
    return step.payload.replace(/\s+\d+%$/, '');
  }

  if (step.status === 'completed') {
    return step.payload; // "Generati!"
  }

  return undefined;
}
