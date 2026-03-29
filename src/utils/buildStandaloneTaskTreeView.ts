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
 * Build a TaskTree for editor preview from persisted standalone fields.
 * Returns null if the task has no instance tree to show.
 */
export function buildStandaloneTaskTreeView(task: Task | null | undefined): TaskTree | null {
  if (!task) return null;
  const rawNodes = task.instanceNodes;
  if (!Array.isArray(rawNodes) || rawNodes.length === 0) {
    return null;
  }

  const nodes = applyContractsToTree(rawNodes as TaskTreeNode[], task.instanceSchemaContracts);
  const steps = task.steps && typeof task.steps === 'object' && !Array.isArray(task.steps)
    ? task.steps
    : {};

  const labelKey = task.labelKey ?? task.label ?? 'standalone_task';

  return {
    labelKey: typeof labelKey === 'string' ? labelKey : 'standalone_task',
    nodes,
    steps,
    constraints: undefined,
    dataContract: undefined,
    introduction: task.introduction,
    label: typeof task.label === 'string' ? task.label : undefined,
  };
}
