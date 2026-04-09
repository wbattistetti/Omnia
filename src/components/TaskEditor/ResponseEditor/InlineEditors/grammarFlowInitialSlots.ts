/**
 * Builds GrammarFlow semantic slots from the Response Editor data tree (policy G2).
 * Each slot has its own id; flow variables are linked only via `slotBindings`.
 */

import { createGrammar } from '@components/GrammarEditor/core/domain/grammar';
import type { Grammar, SemanticSlot } from '@components/GrammarEditor/types/grammarTypes';
import { normalizeForComparison } from '@components/GrammarEditor/core/domain/slotEditor';
import { getNodeLabel, getSubNodes } from '@responseEditor/core/domain';
import type { TaskTreeNode } from '@types/taskTypes';
import { generateSafeGuid } from '@utils/idGenerator';

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

export type GrammarSlotBinding = { grammarSlotId: string; flowVariableId: string };

/**
 * DFS over task-tree nodes: one semantic slot per node with a fresh grammar slot id (G2).
 * Emits mandatory mappings grammarSlotId → TaskTreeNode-backed flow variable id.
 */
export function buildSemanticSlotsAndBindingsFromSingleRootTree(
  root: TaskTreeNode,
  translations?: Record<string, string>
): { slots: SemanticSlot[]; slotBindings: GrammarSlotBinding[] } {
  const slots: SemanticSlot[] = [];
  const slotBindings: GrammarSlotBinding[] = [];
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

    const grammarSlotId = generateSafeGuid();
    const flowVariableId =
      node.taskId && String(node.taskId).trim().length > 0 ? String(node.taskId).trim() : String(node.id || '').trim();

    slots.push({
      id: grammarSlotId,
      name,
      type: mapNodeTypeToSlotType(node.type),
    });
    if (flowVariableId) {
      slotBindings.push({ grammarSlotId, flowVariableId });
    }

    for (const child of getSubNodes(node)) {
      visit(child as TaskTreeNode);
    }
  };

  visit(root);
  return { slots, slotBindings };
}

/** @deprecated Use buildSemanticSlotsAndBindingsFromSingleRootTree; slots no longer share ids with tree nodes (G2). */
export function buildSemanticSlotsFromSingleRootTree(
  root: TaskTreeNode,
  translations?: Record<string, string>
): SemanticSlot[] {
  return buildSemanticSlotsAndBindingsFromSingleRootTree(root, translations).slots;
}

/**
 * Returns a new grammar with slots + slotBindings pre-filled when there is exactly one root.
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
  const { slots, slotBindings } = buildSemanticSlotsAndBindingsFromSingleRootTree(root, translations);
  const base = createGrammar('New Grammar');
  return {
    ...base,
    slots,
    slotBindings,
  };
}
