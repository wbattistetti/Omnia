// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import type { TaskTreeNode } from '../../types/taskTypes';
import type { StructuredConstraint } from '../../types/semanticContract';
import { readEntityConstraints } from './readEntityProperties';

/**
 * Read subgroup meaning from template (deterministic)
 * Tries: constraints[].description -> dataContract.description -> heuristic fallback
 */
export function readSubgroupMeaning(
  subNode: TaskTreeNode | undefined,
  info: { subTaskKey: string; label: string }
): string {
  if (!subNode) {
    return heuristicSubgroupMeaning(info, undefined);
  }

  // Try to read from constraints
  if (subNode.constraints && Array.isArray(subNode.constraints) && subNode.constraints.length > 0) {
    const constraintWithDescription = subNode.constraints.find((c: any) =>
      c?.description || c?.validation?.description
    );
    if (constraintWithDescription) {
      const description = constraintWithDescription.description || constraintWithDescription.validation?.description;
      if (description) {
        return description;
      }
    }
  }

  // Try to read from dataContract
  if (subNode.dataContract) {
    const dataContract = subNode.dataContract as any;
    if (dataContract.description) {
      return dataContract.description;
    }
    if (dataContract.validation?.description) {
      return dataContract.validation.description;
    }
  }

  // Heuristic fallback
  return heuristicSubgroupMeaning(info, subNode);
}

/**
 * Heuristic fallback for subgroup meaning (only used if template doesn't provide description)
 */
function heuristicSubgroupMeaning(
  info: { subTaskKey: string; label: string },
  subNode: TaskTreeNode | undefined
): string {
  const subTaskKey = info.subTaskKey.toLowerCase();

  // Date components
  if (subTaskKey.includes('day') || subTaskKey.includes('giorno')) {
    return 'numeric day of the month (1-31)';
  }
  if (subTaskKey.includes('month') || subTaskKey.includes('mese')) {
    return 'numeric month (1-12) or textual (january, february, etc.)';
  }
  if (subTaskKey.includes('year') || subTaskKey.includes('anno')) {
    return 'year with 2 or 4 digits';
  }

  // Name components
  if (subTaskKey.includes('first') || subTaskKey.includes('nome') || subTaskKey.includes('firstname')) {
    return 'first name or given name';
  }
  if (subTaskKey.includes('last') || subTaskKey.includes('cognome') || subTaskKey.includes('surname') || subTaskKey.includes('lastname')) {
    return 'last name or family name';
  }

  // Address components
  if (subTaskKey.includes('street') || subTaskKey.includes('via') || subTaskKey.includes('indirizzo')) {
    return 'street address';
  }
  if (subTaskKey.includes('city') || subTaskKey.includes('citta') || subTaskKey.includes('comune')) {
    return 'city name';
  }
  if (subTaskKey.includes('zip') || subTaskKey.includes('cap') || subTaskKey.includes('postal')) {
    return 'postal code';
  }
  if (subTaskKey.includes('country') || subTaskKey.includes('nazione') || subTaskKey.includes('paese')) {
    return 'country name';
  }

  // Generic fallback
  return `${info.label.toLowerCase()} of the ${subNode?.type || 'value'}`;
}

/**
 * Read subgroup optionality from template (deterministic)
 */
export function readSubgroupOptionality(subNode: TaskTreeNode | undefined): boolean {
  if (!subNode) return true; // Default: optional

  // Try to read from constraints
  if (subNode.constraints && Array.isArray(subNode.constraints)) {
    const constraintWithRequired = subNode.constraints.find((c: any) =>
      c?.required !== undefined || c?.validation?.required !== undefined
    );
    if (constraintWithRequired) {
      const required = constraintWithRequired.required ?? constraintWithRequired.validation?.required;
      return !required; // optional = !required
    }
  }

  // Try to read from dataContract
  if (subNode.dataContract) {
    const dataContract = subNode.dataContract as any;
    if (dataContract.required !== undefined) {
      return !dataContract.required;
    }
    if (dataContract.validation?.required !== undefined) {
      return !dataContract.validation.required;
    }
  }

  // Default: optional (allows partial input)
  return true;
}

/**
 * Read subgroup formats from template (deterministic)
 */
export function readSubgroupFormats(subNode: TaskTreeNode | undefined): string[] | undefined {
  if (!subNode) return undefined;

  // Try to read from constraints
  if (subNode.constraints && Array.isArray(subNode.constraints)) {
    const constraintWithFormat = subNode.constraints.find((c: any) =>
      c?.format || c?.validation?.format
    );
    if (constraintWithFormat) {
      const format = constraintWithFormat.format || constraintWithFormat.validation?.format;
      if (format) {
        return Array.isArray(format) ? format : [format];
      }
    }
  }

  // Try to read from dataContract
  if (subNode.dataContract) {
    const dataContract = subNode.dataContract as any;
    if (dataContract.format) {
      return Array.isArray(dataContract.format) ? dataContract.format : [dataContract.format];
    }
    if (dataContract.validation?.format) {
      return Array.isArray(dataContract.validation.format)
        ? dataContract.validation.format
        : [dataContract.validation.format];
    }
  }

  // Heuristic fallback
  return inferFormats(subNode);
}

/**
 * Read subgroup normalization from template (deterministic)
 */
export function readSubgroupNormalization(subNode: TaskTreeNode | undefined): string | undefined {
  if (!subNode) return undefined;

  // Try to read from constraints
  if (subNode.constraints && Array.isArray(subNode.constraints)) {
    const constraintWithNormalization = subNode.constraints.find((c: any) =>
      c?.normalization || c?.validation?.normalization
    );
    if (constraintWithNormalization) {
      return constraintWithNormalization.normalization || constraintWithNormalization.validation?.normalization;
    }
  }

  // Try to read from dataContract
  if (subNode.dataContract) {
    const dataContract = subNode.dataContract as any;
    if (dataContract.normalization) {
      return dataContract.normalization;
    }
  }

  // Heuristic fallback
  return inferNormalization(subNode);
}

/**
 * Read subgroup constraints from template (deterministic)
 */
export function readSubgroupConstraints(subNode: TaskTreeNode | undefined): StructuredConstraint | undefined {
  if (!subNode) return undefined;

  // Use the same logic as readEntityConstraints
  return readEntityConstraints(subNode);
}

/**
 * Infer allowed formats from subgroup
 */
function inferFormats(subNode: TaskTreeNode | undefined): string[] {
  const type = subNode?.type?.toLowerCase() || '';
  if (type === 'number') return ['numeric'];
  if (type === 'text') return ['textual'];
  return ['numeric', 'textual'];
}

/**
 * Infer normalization rule from subgroup
 */
function inferNormalization(subNode: TaskTreeNode | undefined): string | undefined {
  const subTaskKey = subNode?.subTaskKey?.toLowerCase() || '';

  if (subTaskKey.includes('year')) {
    return 'year always 4 digits (61 -> 1961, 05 -> 2005)';
  }
  if (subTaskKey.includes('month')) {
    return 'month always numeric (january -> 1, february -> 2)';
  }
  if (subTaskKey.includes('day')) {
    return 'day always numeric (1-31)';
  }

  return undefined;
}
