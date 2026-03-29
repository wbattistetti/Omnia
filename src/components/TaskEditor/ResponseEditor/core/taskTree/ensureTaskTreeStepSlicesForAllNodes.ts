/**
 * Ensures every TaskTreeNode has a Behaviour step slice under TaskTree.steps[templateId].
 * Uses the same key as getStepsForNode / useNodeLoading: node.templateId ?? node.id.
 *
 * Non-destructive: mergeTaskTreeStepsForTemplate only adds missing step keys (start, noMatch).
 * Call at TaskTree write boundaries so downstream code always reads a populated dictionary.
 */

import type { TaskTree, TaskTreeNode } from '@types/taskTypes';
import {
  createDefaultManualStepDictionary,
  mergeTaskTreeStepsForTemplate,
} from './manualDefaultBehaviourSteps';

function collectNodes(nodes: TaskTreeNode[] | undefined, out: TaskTreeNode[]): void {
  if (!nodes?.length) return;
  for (const n of nodes) {
    out.push(n);
    collectNodes(n.subNodes, out);
  }
}

/**
 * For each node in the tree, merges the default manual step dictionary into TaskTree.steps[key]
 * when that slot is missing keys. Does not remove or overwrite existing step definitions.
 */
export function ensureTaskTreeStepSlicesForAllNodes(tree: TaskTree): TaskTree {
  const list: TaskTreeNode[] = [];
  collectNodes(tree.nodes, list);
  if (list.length === 0) {
    return tree;
  }

  const defaults = createDefaultManualStepDictionary();
  let next: TaskTree = tree;
  for (const node of list) {
    const tidRaw = node.templateId ?? node.id;
    const key = typeof tidRaw === 'string' ? tidRaw.trim() : String(tidRaw ?? '').trim();
    if (!key) {
      continue;
    }
    next = mergeTaskTreeStepsForTemplate(next, key, defaults);
  }
  return next;
}
