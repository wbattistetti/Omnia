/**
 * Builds initial GrammarFlow semantic slots from the Response Editor data tree (mainList).
 * Only when there is exactly one root: multi-root behaviour is deferred.
 */

import { createGrammar } from '@components/GrammarEditor/core/domain/grammar';
import type { Grammar, SemanticSlot } from '@components/GrammarEditor/types/grammarTypes';
import { normalizeForComparison } from '@components/GrammarEditor/core/domain/slotEditor';
import { getNodeLabel, getSubNodes } from '@responseEditor/core/domain';
import type { TaskTreeNode } from '@types/taskTypes';

function mapNodeTypeToSlotType(nodeType: string | undefined): SemanticSlot['type'] {
  const t = (nodeType || '').toLowerCase();
  if (t === 'number' || t === 'integer' || t === 'float') return 'number';
  if (t === 'date' || t === 'datetime' || t === 'time') return 'date';
  if (t === 'boolean') return 'boolean';
  if (t === 'object' || t === 'json') return 'object';
  return 'string';
}

function ensureSlotName(raw: string, fallback: string): string {
  const t = raw.trim();
  if (t.length >= 2) return t;
  if (t.length === 1) return `${t}_`;
  return fallback.length >= 2 ? fallback : 'slot';
}

/**
 * DFS over task-tree nodes: one semantic slot per node (root + descendants), in tree order.
 */
export function buildSemanticSlotsFromSingleRootTree(
  root: TaskTreeNode,
  translations?: Record<string, string>
): SemanticSlot[] {
  const slots: SemanticSlot[] = [];
  const usedNormalized = new Set<string>();

  const visit = (node: TaskTreeNode) => {
    const label = getNodeLabel(node, translations);
    const fallback = (node.taskId || node.id || 'field').slice(0, 12);
    let name = ensureSlotName(label, fallback);

    let norm = normalizeForComparison(name);
    let suffix = 0;
    while (usedNormalized.has(norm)) {
      suffix += 1;
      name = `${ensureSlotName(label, fallback)}_${suffix}`;
      norm = normalizeForComparison(name);
    }
    usedNormalized.add(norm);

    const id = node.taskId && node.taskId.length > 0 ? node.taskId : node.id;
    slots.push({
      id,
      name,
      type: mapNodeTypeToSlotType(node.type),
    });

    for (const child of getSubNodes(node)) {
      visit(child as TaskTreeNode);
    }
  };

  visit(root);
  return slots;
}

/**
 * Returns a new grammar with slots pre-filled from `mainList` when there is exactly one root.
 * Otherwise returns null (caller should use empty `createGrammar` or existing contract grammar).
 */
export function buildNewGrammarWithSlotsFromMainList(
  mainList: unknown[] | null | undefined,
  translations?: Record<string, string>
): Grammar | null {
  if (!Array.isArray(mainList) || mainList.length !== 1) {
    return null;
  }
  const root = mainList[0] as TaskTreeNode;
  if (!root || typeof root !== 'object' || !root.id) {
    return null;
  }
  const slots = buildSemanticSlotsFromSingleRootTree(root, translations);
  const base = createGrammar('New Grammar');
  return {
    ...base,
    slots,
  };
}
