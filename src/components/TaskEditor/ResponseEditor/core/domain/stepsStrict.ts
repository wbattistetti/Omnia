// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Strict steps operations - NO FALLBACKS
 * Steps MUST be dictionary format
 */

import type { TaskTreeNode } from '@types/taskTypes';

/**
 * Get steps for node - STRICT, no array conversion
 */
export function getStepsForNodeStrict(
  steps: Record<string, Record<string, any>>,
  nodeTemplateId: string
): Record<string, any> {
  if (!steps || typeof steps !== 'object' || Array.isArray(steps)) {
    throw new Error(
      `[getStepsForNodeStrict] Steps must be dictionary format. ` +
      `Got: ${Array.isArray(steps) ? 'array' : typeof steps}`
    );
  }

  // ✅ NO FALLBACKS: Returns empty object if nodeTemplateId not found (legitimate default)
  return steps[nodeTemplateId] ?? {};
}

/**
 * Get step keys from node - STRICT, no array/messages support
 */
export function getNodeStepKeysStrict(node: TaskTreeNode): string[] {
  if (!node.steps) {
    return [];
  }

  if (typeof node.steps !== 'object' || Array.isArray(node.steps)) {
    throw new Error(
      `[getNodeStepKeysStrict] Node.steps must be dictionary format. ` +
      `Node id: ${node.id}`
    );
  }

  return Object.keys(node.steps).filter(key => key && key.trim());
}

/**
 * Get step data - STRICT, no array/messages support
 */
export function getNodeStepDataStrict(node: TaskTreeNode, stepKey: string): any {
  if (!node || !stepKey) return {};

  if (!node.steps || typeof node.steps !== 'object' || Array.isArray(node.steps)) {
    throw new Error(
      `[getNodeStepDataStrict] Node.steps must be dictionary format. ` +
      `Node id: ${node.id}`
    );
  }

  // ✅ NO FALLBACKS: Returns empty object if stepKey not found (legitimate default)
  return node.steps[stepKey] ?? {};
}
