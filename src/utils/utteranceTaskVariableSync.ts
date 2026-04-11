/**
 * Derives project variable rows (per TaskTree node) for UtteranceInterpretation tasks.
 * Identity = TaskTreeNode.id (GUID). Labels live only in flow.meta.translations[var:<guid>][locale].
 */

import type { TaskTreeNode } from '@types/taskTypes';
import { generateInitialVariableLabel } from './generateInitialVariableLabel';

export type UtteranceVariableRow = { id: string; dataPath: string };

/** Finds a node by id in the task tree (depth-first). */
export function findTaskTreeNodeById(
  roots: TaskTreeNode[] | undefined | null,
  wantId: string
): TaskTreeNode | null {
  const tid = String(wantId || '').trim();
  if (!tid) return null;
  const list = Array.isArray(roots) ? roots.filter(Boolean) : [];

  const walk = (node: TaskTreeNode): TaskTreeNode | null => {
    const id = String(node.id || node.templateId || '').trim();
    if (id === tid) return node;
    const subs = Array.isArray(node.subNodes) ? node.subNodes.filter(Boolean) : [];
    for (const sub of subs) {
      const hit = walk(sub);
      if (hit) return hit;
    }
    return null;
  };

  for (const root of list) {
    const hit = walk(root);
    if (hit) return hit;
  }
  return null;
}

/**
 * Walks `roots` depth-first and returns one row per node: id + JSON instance path only (no labels).
 */
export function flattenUtteranceTaskTreeVariableRows(
  roots: TaskTreeNode[] | undefined | null
): UtteranceVariableRow[] {
  const list: TaskTreeNode[] = Array.isArray(roots) ? roots.filter(Boolean) : [];
  if (list.length === 0) {
    return [];
  }
  const out: UtteranceVariableRow[] = [];

  const walk = (node: TaskTreeNode, _mainIndex: number, dataPath: string, depth: number) => {
    const id = String(node.id || node.templateId || '').trim();
    if (!id) {
      return;
    }

    out.push({ id, dataPath });

    const subs = Array.isArray(node.subNodes) ? node.subNodes.filter(Boolean) : [];
    subs.forEach((sub, i) => {
      const subPath = `${dataPath}.subData[${i}]`;
      walk(sub, _mainIndex, subPath, depth + 1);
    });
  };

  list.forEach((root, mainIndex) => {
    walk(root, mainIndex, `data[${mainIndex}]`, 0);
  });

  return out;
}

/** Initial translation text for one utterance node (Rule 5–6): only from that node's task label. */
export function initialUtteranceLabelForNode(node: TaskTreeNode | null | undefined): string {
  const raw = String(node?.label || '').trim();
  return generateInitialVariableLabel(raw);
}
