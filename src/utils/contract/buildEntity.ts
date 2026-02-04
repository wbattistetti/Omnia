// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * CONTRACT LAYER - buildEntity.ts
 *
 * Main orchestrator for building semantic contracts from TaskTree nodes.
 * This module coordinates all contract-building sub-modules:
 * - readEntityProperties: Extracts entity-level properties
 * - readSubgroupProperties: Extracts subgroup-level properties (via buildSubgroups)
 * - buildSubgroups: Builds subgroup structures
 *
 * Architecture:
 * - Pure function: No side effects, deterministic output
 * - Orchestrates contract building sub-modules
 * - Handles both simple and composite nodes
 * - Maintains stable ordering of subentities
 *
 * Contract Structure:
 * - Entity: Root-level properties (label, description, constraints)
 * - Subgroups: Child nodes with their own properties
 * - Canonical Format: Handles both value and object formats
 *
 * @see ARCHITECTURE.md for complete architecture documentation
 * @see readEntityProperties.ts for entity property extraction
 * @see buildSubgroups.ts for subgroup building
 */

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
 *
 * This is the main entry point for contract building.
 * Orchestrates all contract-building sub-modules to create a complete
 * semantic contract that will be persisted in the task template.
 *
 * Contract Building Flow:
 * 1. Read entity-level properties (description, constraints, normalization)
 * 2. Build subgroups from child nodes (if composite)
 * 3. Assemble complete contract structure
 * 4. Add metadata (version, timestamps)
 *
 * Properties:
 * - DETERMINISTIC: Reads from template, uses heuristics only as fallback
 * - STABLE ORDER: Subgroups maintain consistent ordering
 * - CANONICAL FORMAT: Handles both value and object formats
 *
 * @param node - TaskTreeNode to build contract for (can be null)
 * @returns Complete SemanticContract or null if node is null
 *
 * @example
 * ```typescript
 * const contract = buildSemanticContract(node);
 * if (contract) {
 *   await SemanticContractService.save(contract);
 * }
 * ```
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
