// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import type { TaskTreeNode } from '../../types/taskTypes';
import type { SemanticContract, RedefinitionPolicy } from '../../types/semanticContract';
import { getSubTasksInfo } from '../../components/TaskEditor/ResponseEditor/utils/regexGroupUtils';
import {
  readEntityDescription,
  readEntityConstraints,
  readEntityNormalization,
  readRedefinitionPolicy
} from './readEntityProperties';
import { buildSubgroups } from './buildSubgroups';

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
  const subentities = isComposite ? buildSubgroups(node, subTasksInfo) : undefined;

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
