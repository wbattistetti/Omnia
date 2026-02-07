/**
 * Node Domain Operations - STRICT MODE
 *
 * Pure functions for node operations.
 * NO FALLBACKS - Throws errors for invalid data
 */

import { validateNodeStructure } from './validators';
import type { TaskTreeNode } from '@types/taskTypes';

/**
 * Get step keys from a node - STRICT, dictionary only
 */
export function getNodeStepKeys(node: TaskTreeNode | null | undefined): string[] {
  if (!node) {
    return [];
  }

  validateNodeStructure(node, 'getNodeStepKeys');

  if (!node.steps || typeof node.steps !== 'object' || Array.isArray(node.steps)) {
    return [];
  }

  const stepKeys = Object.keys(node.steps);
  const DEFAULT_STEP_ORDER = [
    'start',
    'noInput',
    'noMatch',
    'explicitConfirmation',
    'confirmation',
    'notConfirmed',
    'success',
    'error',
  ];

  const present = stepKeys.filter(key => key && key.trim());
  const orderedKnown = DEFAULT_STEP_ORDER.filter((k) => present.includes(k));
  const custom = present.filter((k) => !DEFAULT_STEP_ORDER.includes(k)).sort();
  return [...orderedKnown, ...custom];
}

/**
 * Get messages/step data for a specific step key - STRICT, dictionary only
 */
export function getNodeStepData(node: TaskTreeNode | null | undefined, stepKey: string): any {
  if (!node || !stepKey) return {};

  validateNodeStructure(node, 'getNodeStepData');

  if (!node.steps || typeof node.steps !== 'object' || Array.isArray(node.steps)) {
    return {};
  }

  return node.steps[stepKey] || {};
}

/**
 * Get node label - STRICT, no fallback
 */
export function getNodeLabel(node: TaskTreeNode | null | undefined, translations?: Record<string, string>): string {
  if (!node) return '';

  validateNodeStructure(node, 'getNodeLabel');

  // Priority 1: Use Translations if available
  if (translations && node.id && translations[node.id]) {
    return translations[node.id];
  }

  // Priority 2: Return node.label
  return node.label || '';
}

/**
 * Remove a node from nodes array (pure function)
 * Optionally removes children recursively
 */
export function removeNode(
  nodes: any[],
  id: string,
  removeChildren: boolean
): any[] {
  if (!removeChildren) {
    return nodes.filter(n => n.id !== id);
  }

  const toRemove = new Set([id]);
  let changed = true;

  while (changed) {
    changed = false;
    for (const n of nodes) {
      if (n.parentId && toRemove.has(n.parentId) && !toRemove.has(n.id)) {
        toRemove.add(n.id);
        changed = true;
      }
    }
  }

  return nodes.filter(n => !toRemove.has(n.id));
}
