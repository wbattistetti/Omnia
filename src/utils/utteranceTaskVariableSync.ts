/**
 * Derives project variable rows (per TaskTree node) for UtteranceInterpretation tasks.
 * One row per node: id = TaskTreeNode.id (GUID), dataPath = instance JSON path, varName = display label.
 */

import type { TaskTreeNode } from '@types/taskTypes';
import { normalizeProxySegment, normalizeSemanticTaskLabel } from '@domain/variableProxyNaming';

export type UtteranceVariableRow = { id: string; varName: string; dataPath: string };

function segmentForPath(raw: string): string {
  const s = normalizeProxySegment(raw).toLowerCase().trim().replace(/\s+/g, ' ') || 'campo';
  return s;
}

/**
 * Walks `roots` and returns one row per node (depth-first), with dotted var names for display only.
 */
export function flattenUtteranceTaskTreeVariableRows(
  taskRowLabel: string,
  roots: TaskTreeNode[] | undefined | null
): UtteranceVariableRow[] {
  const normalizedTask = normalizeSemanticTaskLabel(taskRowLabel);
  const base = normalizedTask || normalizeProxySegment(taskRowLabel) || 'task';
  const list: TaskTreeNode[] = Array.isArray(roots) ? roots.filter(Boolean) : [];
  if (list.length === 0) {
    return [];
  }
  const hasMultipleMains = list.length > 1;
  const out: UtteranceVariableRow[] = [];

  const walk = (node: TaskTreeNode, _mainIndex: number, dataPath: string, depth: number, parentDotted: string | null) => {
    const id = String(node.id || node.templateId || '').trim();
    if (!id) {
      return;
    }

    let dotted: string;
    if (depth === 0) {
      if (hasMultipleMains) {
        dotted = `${base}.${segmentForPath(node.label || '')}`;
      } else {
        dotted = base;
      }
    } else {
      dotted = `${parentDotted}.${segmentForPath(node.label || '')}`;
    }

    out.push({ id, varName: dotted, dataPath });

    const subs = Array.isArray(node.subNodes) ? node.subNodes.filter(Boolean) : [];
    subs.forEach((sub, i) => {
      const subPath = `${dataPath}.subData[${i}]`;
      walk(sub, _mainIndex, subPath, depth + 1, dotted);
    });
  };

  list.forEach((root, mainIndex) => {
    walk(root, mainIndex, `data[${mainIndex}]`, 0, null);
  });

  return out;
}
