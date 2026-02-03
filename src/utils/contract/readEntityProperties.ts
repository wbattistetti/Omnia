// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import type { TaskTreeNode } from '../../types/taskTypes';
import type { StructuredConstraint, RedefinitionPolicy } from '../../types/semanticContract';

/**
 * Read entity description from template (deterministic)
 * Tries: constraints[].description -> dataContract.description -> heuristic fallback
 */
export function readEntityDescription(
  node: TaskTreeNode,
  subTasksInfo: Array<{ subTaskKey: string; label: string }>
): string {
  // Try to read from constraints
  if (node.constraints && Array.isArray(node.constraints) && node.constraints.length > 0) {
    const constraintWithDescription = node.constraints.find((c: any) =>
      c?.description || c?.validation?.description
    );
    if (constraintWithDescription) {
      return constraintWithDescription.description || constraintWithDescription.validation?.description || '';
    }
  }

  // Try to read from dataContract
  if (node.dataContract) {
    const dataContract = node.dataContract as any;
    if (dataContract.description) {
      return dataContract.description;
    }
    if (dataContract.validation?.description) {
      return dataContract.validation.description;
    }
  }

  // Heuristic fallback
  if (subTasksInfo.length === 0) {
    return `a simple ${node.type || 'value'}`;
  }

  const components = subTasksInfo.map(info => info.label.toLowerCase()).join(', ');
  return `a ${node.label.toLowerCase()} composed of ${components}`;
}

/**
 * Read entity constraints from template (deterministic)
 */
export function readEntityConstraints(node: TaskTreeNode): StructuredConstraint | undefined {
  if (!node.constraints || !Array.isArray(node.constraints) || node.constraints.length === 0) {
    return undefined;
  }

  // Try to find structured constraint
  const constraint = node.constraints[0] as any;
  const validation = constraint?.validation || constraint;

  if (!validation) {
    return undefined;
  }

  const structured: StructuredConstraint = {};

  // Read min/max
  if (validation.min !== undefined) structured.min = validation.min;
  if (validation.max !== undefined) structured.max = validation.max;
  if (validation.minLength !== undefined) structured.minLength = validation.minLength;
  if (validation.maxLength !== undefined) structured.maxLength = validation.maxLength;

  // Read format
  if (validation.format) {
    structured.format = Array.isArray(validation.format) ? validation.format : [validation.format];
  }

  // Read pattern
  if (validation.pattern || validation.regex) {
    structured.pattern = validation.pattern || validation.regex;
  }

  // Read required
  if (validation.required !== undefined) {
    structured.required = validation.required;
  }

  // Read examples
  if (validation.examples) {
    structured.examples = {
      valid: validation.examples.valid,
      invalid: validation.examples.invalid,
      edgeCases: validation.examples.edgeCases
    };
  }

  // Read description
  if (validation.description || constraint.description) {
    structured.description = validation.description || constraint.description;
  }

  return Object.keys(structured).length > 0 ? structured : undefined;
}

/**
 * Read entity normalization from template (deterministic)
 */
export function readEntityNormalization(node: TaskTreeNode): string | undefined {
  // Try to read from constraints
  if (node.constraints && Array.isArray(node.constraints)) {
    const constraintWithNormalization = node.constraints.find((c: any) =>
      c?.normalization || c?.validation?.normalization
    );
    if (constraintWithNormalization) {
      return constraintWithNormalization.normalization || constraintWithNormalization.validation?.normalization;
    }
  }

  // Try to read from dataContract
  if (node.dataContract) {
    const dataContract = node.dataContract as any;
    if (dataContract.normalization) {
      return dataContract.normalization;
    }
  }

  return undefined;
}

/**
 * Read redefinitionPolicy from template (deterministic)
 */
export function readRedefinitionPolicy(node: TaskTreeNode): RedefinitionPolicy | undefined {
  // Try to read from constraints
  if (node.constraints && Array.isArray(node.constraints)) {
    const constraintWithPolicy = node.constraints.find((c: any) =>
      c?.redefinitionPolicy || c?.validation?.redefinitionPolicy
    );
    if (constraintWithPolicy) {
      return constraintWithPolicy.redefinitionPolicy || constraintWithPolicy.validation?.redefinitionPolicy;
    }
  }

  // Try to read from dataContract
  if (node.dataContract) {
    const dataContract = node.dataContract as any;
    if (dataContract.redefinitionPolicy) {
      return dataContract.redefinitionPolicy;
    }
  }

  return undefined;
}
