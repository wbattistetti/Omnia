/**
 * Resolves user-visible DSL bracket labels from project translations.
 * Flat `variables` map keys may be legacy display strings or GUIDs; tree nodes may carry optional `id` / `variableId`.
 */

import { getVariableLabel } from './getVariableLabel';

const GUID_TOKEN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * When a variables-map key is a bare GUID, show the translation; otherwise the key is already a label.
 */
export function dslFlatVariableDisplayKey(key: string, translations: Record<string, string>): string {
  const k = String(key || '').trim();
  if (!k) return k;
  if (GUID_TOKEN.test(k)) {
    return getVariableLabel(k, translations) || k;
  }
  return k;
}

type TreeNodeLike = { label?: string; id?: string; variableId?: string };

/**
 * Stable variable id for translation lookup from a template / persisted task-tree node.
 * Matches {@link VariableCreationService} (id, _id, templateId) and prefers {@link TaskTreeNode.taskId} when set.
 */
export function resolveTemplateTreeNodeVariableId(node: unknown): string {
  const n = node as Record<string, unknown> | null | undefined;
  if (!n || typeof n !== 'object') return '';
  const pick = (k: string) => String(n[k] ?? '').trim();
  return pick('taskId') || pick('id') || pick('variableId') || pick('_id') || pick('templateId');
}

/**
 * Prefer translation for a stable id on the node; otherwise use `label` (e.g. template tree without GUIDs).
 */
export function dslTreeNodeDisplayLabel(node: TreeNodeLike, translations: Record<string, string>): string {
  const id = String(node?.id || node?.variableId || '').trim();
  if (id) {
    const t = getVariableLabel(id, translations);
    if (t) return t;
  }
  return String(node?.label || '').trim();
}
