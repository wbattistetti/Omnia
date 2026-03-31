/**
 * Flattens per-node behaviour steps into the task-level `steps` dictionary used by the editor/runtime.
 * Source of truth for instance data is `subTasks[].steps`; the flat map is a derived index keyed by
 * `node.templateId ?? node.id`.
 */

import type { TaskTreeNode } from '@types/taskTypes';

/**
 * True when steps is a non-empty dictionary (not MaterializedStep[]).
 */
function isNonEmptyStepDictionary(steps: unknown): steps is Record<string, unknown> {
  return (
    !!steps &&
    typeof steps === 'object' &&
    !Array.isArray(steps) &&
    Object.keys(steps as Record<string, unknown>).length > 0
  );
}

function treeStepSlotIsEmpty(steps: Record<string, unknown>, templateId: string): boolean {
  const slot = steps[templateId];
  if (slot == null) return true;
  if (typeof slot !== 'object' || Array.isArray(slot)) return true;
  return Object.keys(slot as Record<string, unknown>).length === 0;
}

/**
 * Merges `node.steps` from the instance tree into `stepsRoot` when the slot for that node key is empty.
 * Use the same merge on load (`buildStandaloneTaskTreeView`) and on save so `task.steps` stays aligned
 * with `subTasks` without two divergent sources of truth.
 */
export function mergeInstanceNodeStepsIntoTreeSteps(
  nodes: TaskTreeNode[],
  stepsRoot: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...stepsRoot };
  const walk = (node: TaskTreeNode) => {
    const tidRaw = node.templateId ?? node.id;
    const tid = typeof tidRaw === 'string' ? tidRaw.trim() : String(tidRaw ?? '').trim();
    if (!tid) {
      return;
    }
    if (treeStepSlotIsEmpty(out, tid) && isNonEmptyStepDictionary(node.steps)) {
      out[tid] = { ...(node.steps as Record<string, unknown>) };
    }
    const subs = node.subNodes;
    if (Array.isArray(subs) && subs.length > 0) {
      subs.forEach(walk);
    }
  };
  nodes.forEach(walk);
  return out;
}
