// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import type { TaskTreeNode } from '../types/taskTypes';
import type { SemanticContract, SemanticSubgroup, StructuredConstraint, RedefinitionPolicy } from '../types/semanticContract';
import { getSubTasksInfo } from '../components/TaskEditor/ResponseEditor/utils/regexGroupUtils';

/**
 * Build semantic contract from TaskTreeNode
 * This contract will be persisted in the task template
 *
 * DETERMINISTIC: Reads description and constraints from template, uses heuristics only as fallback
 * Each node (root and children) has its own contract generated separately
 */
export function buildSemanticContract(node: TaskTreeNode | null): SemanticContract | null {
  if (!node) return null;

  const subTasksInfo = getSubTasksInfo(node);
  const isComposite = subTasksInfo.length > 0;

  // Build entity (new structure)
  const entity = {
    label: node.label || node.id,
    type: node.type || 'generic',
    description: readEntityDescription(node, subTasksInfo)
  };

  // Build subentities (only if composite)
  const subentities = isComposite ? subTasksInfo.map((info, index) => {
    const subNode = node.subNodes?.[index];
    return buildSubgroup(subNode, info);
  }) : undefined;

  // Read constraints for main entity
  const constraints = readEntityConstraints(node);

  // Read normalization for main entity
  const normalization = readEntityNormalization(node);

  // Read redefinitionPolicy (default: 'last_wins')
  const redefinitionPolicy: RedefinitionPolicy = readRedefinitionPolicy(node) || 'last_wins';

  // Output canonical
  const outputCanonical = isComposite
    ? {
        format: 'object' as const,
        keys: subentities!.map(sg => sg.subTaskKey)
      }
    : {
        format: 'value' as const
      };

  // Build contract with new structure
  const contract: SemanticContract = {
    entity,
    subentities,
    constraints,
    normalization,
    redefinitionPolicy,
    outputCanonical,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    // Legacy fields for backward compatibility
    mainGroup: {
      name: entity.label,
      description: entity.description,
      kind: entity.type
    },
    subgroups: subentities
  };

  return contract;
}

/**
 * Read entity description from template (deterministic)
 * Tries: constraints[].description -> dataContract.description -> heuristic fallback
 */
function readEntityDescription(
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
function readEntityConstraints(node: TaskTreeNode): StructuredConstraint | undefined {
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
function readEntityNormalization(node: TaskTreeNode): string | undefined {
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
function readRedefinitionPolicy(node: TaskTreeNode): RedefinitionPolicy | undefined {
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

/**
 * Build a single subgroup (deterministic)
 * Reads description and constraints from template, uses heuristics only as fallback
 */
function buildSubgroup(
  subNode: TaskTreeNode | undefined,
  info: { subTaskKey: string; label: string }
): SemanticSubgroup {
  return {
    subTaskKey: info.subTaskKey,
    label: info.label,
    meaning: readSubgroupMeaning(subNode, info),
    type: subNode?.type,
    optional: readSubgroupOptionality(subNode),
    formats: readSubgroupFormats(subNode),
    normalization: readSubgroupNormalization(subNode),
    constraints: readSubgroupConstraints(subNode)
  };
}

/**
 * Read subgroup meaning from template (deterministic)
 * Tries: constraints[].description -> dataContract.description -> heuristic fallback
 */
function readSubgroupMeaning(
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
function readSubgroupOptionality(subNode: TaskTreeNode | undefined): boolean {
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
function readSubgroupFormats(subNode: TaskTreeNode | undefined): string[] | undefined {
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
function readSubgroupNormalization(subNode: TaskTreeNode | undefined): string | undefined {
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
function readSubgroupConstraints(subNode: TaskTreeNode | undefined): StructuredConstraint | undefined {
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
