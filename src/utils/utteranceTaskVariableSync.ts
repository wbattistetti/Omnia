/**
 * Derives project variable rows (per TaskTree node) for UtteranceInterpretation tasks.
 * Naming aligns with VariableCreationService.createVariablesForInstance + wizard dotted paths:
 * single main root uses normalized row label only; multiple roots append a segment per main;
 * nested nodes append normalized segments with dots.
 */

import type { TaskTreeNode } from '@types/taskTypes';
import { disambiguateProxyVarName, normalizeProxySegment, normalizeSemanticTaskLabel } from '@domain/variableProxyNaming';

export type UtteranceVariableRow = { nodeId: string; varName: string; ddtPath: string };

function segmentForPath(raw: string): string {
  const s = normalizeProxySegment(raw).toLowerCase().trim().replace(/\s+/g, ' ') || 'campo';
  return s;
}

/**
 * Walks `roots` and returns one row per node (depth-first), with dotted var names.
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

  const walk = (node: TaskTreeNode, mainIndex: number, ddtPath: string, depth: number, parentDotted: string | null) => {
    const nodeId = String(node.id || node.templateId || '').trim();
    if (!nodeId) {
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

    out.push({ nodeId, varName: dotted, ddtPath });

    const subs = Array.isArray(node.subNodes) ? node.subNodes.filter(Boolean) : [];
    subs.forEach((sub, i) => {
      const subPath = `${ddtPath}.subData[${i}]`;
      walk(sub, mainIndex, subPath, depth + 1, dotted);
    });
  };

  list.forEach((root, mainIndex) => {
    walk(root, mainIndex, `data[${mainIndex}]`, 0, null);
  });

  const used = new Set<string>();
  return out.map((row) => {
    const name = disambiguateProxyVarName(row.varName, (n) => used.has(n));
    used.add(name);
    return { ...row, varName: name };
  });
}
