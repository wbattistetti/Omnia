// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import type { TaskTreeNode } from '../../types/taskTypes';
import type { SemanticSubgroup } from '../../types/semanticContract';
import {
  readSubgroupMeaning,
  readSubgroupOptionality,
  readSubgroupFormats,
  readSubgroupNormalization,
  readSubgroupConstraints
} from './readSubgroupProperties';

/**
 * Build a single subgroup (deterministic)
 * Reads description and constraints from template, uses heuristics only as fallback
 */
export function buildSubgroup(
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
 * Build all subgroups for a composite node
 */
export function buildSubgroups(
  node: TaskTreeNode,
  subTasksInfo: Array<{ subTaskKey: string; label: string }>
): SemanticSubgroup[] {
  return subTasksInfo.map((info, index) => {
    const subNode = node.subNodes?.[index];
    return buildSubgroup(subNode, info);
  });
}
