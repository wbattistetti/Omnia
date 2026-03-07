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
