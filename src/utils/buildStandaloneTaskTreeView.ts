/**
 * Materialize TaskTree view from a standalone Task row (local schema + steps only).
 * No DialogueTaskService / template cache required.
 */

import type { Task, TaskTree, TaskTreeNode } from '@types/taskTypes';

function mergeNodeContract(node: TaskTreeNode, contracts: Record<string, unknown> | undefined): TaskTreeNode {
  if (!contracts) return node;
  const extra = contracts[node.id];
  if (extra && typeof extra === 'object') {
    const o = extra as Record<string, unknown>;
    return {
      ...node,
      dataContract: o.dataContract !== undefined ? o.dataContract : node.dataContract,
      constraints: o.constraints !== undefined ? (o.constraints as any[]) : node.constraints,
    };
  }
  return node;
}

function applyContractsToTree(
  nodes: TaskTreeNode[],
  contracts: Record<string, unknown> | undefined
): TaskTreeNode[] {
  return nodes.map((n) => {
    const withC = mergeNodeContract(n, contracts);
    const subs = n.subNodes?.length
      ? applyContractsToTree(n.subNodes, contracts)
      : n.subNodes;
    return { ...withC, subNodes: subs };
  });
}

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
 * After reload, `task.steps` is often {} while each node still carries `node.steps` (saved in instanceNodes).
 * Behaviour reads steps from TaskTree.steps[templateId]; without this merge, useNodeLoading overwrites node.steps with {}.
 */
function mergeInstanceNodeStepsIntoTreeSteps(
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

/**
 * Minimal editable TaskTree for standalone rows with no instanceNodes yet (empty shell).
 */
export function buildMinimalStandaloneTaskTree(task: Task | null | undefined): TaskTree {
  const steps =
    task?.steps && typeof task.steps === 'object' && !Array.isArray(task.steps)
      ? { ...task.steps }
      : {};
  const labelText =
    typeof task?.labelKey === 'string'
      ? task.labelKey
      : typeof task?.label === 'string'
        ? task.label
        : '';

  return {
    labelKey: labelText || 'task',
    label: typeof task?.label === 'string' ? task.label : undefined,
    nodes: [],
    steps,
    constraints: undefined,
    dataContract: undefined,
    introduction: task?.introduction,
  };
}

/**
 * Build a TaskTree for editor preview from persisted standalone fields.
 * Returns null if the task has no instance tree to show (use buildMinimalStandaloneTaskTree for empty shells).
 */
export function buildStandaloneTaskTreeView(task: Task | null | undefined): TaskTree | null {
  if (!task) return null;
  const rawNodes = task.instanceNodes;
  if (!Array.isArray(rawNodes) || rawNodes.length === 0) {
    return null;
  }

  const nodes = applyContractsToTree(rawNodes as TaskTreeNode[], task.instanceSchemaContracts);
  const stepsBase: Record<string, unknown> =
    task.steps && typeof task.steps === 'object' && !Array.isArray(task.steps)
      ? { ...task.steps }
      : {};
  const steps = mergeInstanceNodeStepsIntoTreeSteps(nodes, stepsBase);

  const labelKey = task.labelKey ?? task.label ?? 'standalone_task';

  return {
    labelKey: typeof labelKey === 'string' ? labelKey : 'standalone_task',
    nodes,
    steps: steps as TaskTree['steps'],
    constraints: undefined,
    dataContract: undefined,
    introduction: task.introduction,
    label: typeof task.label === 'string' ? task.label : undefined,
  };
}
