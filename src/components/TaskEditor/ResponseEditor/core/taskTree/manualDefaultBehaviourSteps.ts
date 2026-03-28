/**
 * Default Behaviour steps for nodes created in manual sidebar flow (root or nested).
 * Ensures getNodeStepKeys is non-empty so the editor shows "Chiedo il dato" (start) and
 * "Non capisco" (noMatch) instead of only the notConfirmed strip fallback.
 */

import type { TaskTree, TaskTreeNode } from '@types/taskTypes';
import { createManualTaskTreeNode } from './taskTreeUtils';

/** Minimal escalation shell used across the editor when adding a step. */
export function createDefaultManualStepDictionary(): Record<
  string,
  { type: string; escalations: Array<{ tasks: unknown[] }> }
> {
  return {
    start: { type: 'start', escalations: [{ tasks: [] }] },
    noMatch: { type: 'noMatch', escalations: [{ tasks: [] }] },
  };
}

/**
 * Returns a copy of the node with default steps if it has no step dictionary yet.
 */
export function withDefaultManualBehaviourSteps(node: TaskTreeNode): TaskTreeNode {
  if (
    node.steps &&
    typeof node.steps === 'object' &&
    !Array.isArray(node.steps) &&
    Object.keys(node.steps).length > 0
  ) {
    return node;
  }
  return {
    ...node,
    steps: createDefaultManualStepDictionary(),
  };
}

/**
 * Merges template steps for a node into TaskTree.steps[templateId] (instance/template layer).
 * Does not overwrite existing keys for that template.
 */
export function mergeTaskTreeStepsForTemplate(
  tree: TaskTree,
  nodeTemplateId: string,
  defaults: Record<string, { type: string; escalations: Array<{ tasks: unknown[] }> }>
): TaskTree {
  const prevRoot =
    tree.steps && typeof tree.steps === 'object' && !Array.isArray(tree.steps)
      ? { ...tree.steps }
      : {};
  const prevNode =
    prevRoot[nodeTemplateId] &&
    typeof prevRoot[nodeTemplateId] === 'object' &&
    !Array.isArray(prevRoot[nodeTemplateId])
      ? { ...(prevRoot[nodeTemplateId] as Record<string, unknown>) }
      : {};
  const merged: Record<string, unknown> = { ...prevNode };
  for (const [k, v] of Object.entries(defaults)) {
    if (merged[k] == null) {
      merged[k] = v;
    }
  }
  return {
    ...tree,
    steps: {
      ...prevRoot,
      [nodeTemplateId]: merged as Record<string, any>,
    },
  };
}

/**
 * Creates a manual tree node with default behaviour steps; treePatch merges template steps into TaskTree.steps.
 */
export function createManualTaskTreeNodeWithDefaultBehaviour(
  label: string,
  options?: { required?: boolean }
): { node: TaskTreeNode; treePatch: (tree: TaskTree) => TaskTree } {
  const node = withDefaultManualBehaviourSteps(createManualTaskTreeNode(label, options));
  const tid = node.templateId ?? node.id;
  const stepDict = node.steps as Record<string, { type: string; escalations: Array<{ tasks: unknown[] }> }>;
  return {
    node,
    treePatch: (tree: TaskTree) => mergeTaskTreeStepsForTemplate(tree, tid, stepDict),
  };
}
