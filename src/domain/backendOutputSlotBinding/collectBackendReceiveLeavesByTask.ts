/**
 * Path RECEIVE raggruppati per Backend Call: walk OpenAPI output + merge wire `apiField`.
 */

import type { Task } from '@types/taskTypes';
import { TaskType } from '@types/taskTypes';
import { deriveExportedToolName } from '@domain/iaAgentTools/backendToolDerivation';
import {
  collectBackendReceiveLeavesFromTask,
  type BackendReceiveParamLeaf,
} from '@domain/openApi/backendReceiveParamCatalog';
import { inferSlotIdFromApiPath } from './inferSlotIdFromApiPath';

export type BackendReceivePathLeaf = BackendReceiveParamLeaf;

export type BackendReceiveLeavesGroup = {
  backendTaskId: string;
  toolName: string;
  leaves: BackendReceivePathLeaf[];
};

function collectWireReceivePathsFromTask(task: Task): BackendReceivePathLeaf[] {
  const outputs = Array.isArray((task as Task & { outputs?: unknown[] }).outputs)
    ? (task as Task & { outputs: Array<{ apiField?: string }> }).outputs
    : [];
  const out: BackendReceivePathLeaf[] = [];
  const seen = new Set<string>();
  for (const row of outputs) {
    const path = String(row.apiField ?? '').trim();
    if (!path || seen.has(path)) continue;
    seen.add(path);
    out.push({
      path,
      type: 'wire',
      suggestedSlotId: inferSlotIdFromApiPath(path),
    });
  }
  return out;
}

function mergeReceiveLeaves(
  openapiLeaves: readonly BackendReceiveParamLeaf[],
  wireLeaves: readonly BackendReceivePathLeaf[]
): BackendReceivePathLeaf[] {
  const byPath = new Map<string, BackendReceivePathLeaf>();
  for (const leaf of openapiLeaves) {
    byPath.set(leaf.path, { ...leaf });
  }
  for (const wire of wireLeaves) {
    const prev = byPath.get(wire.path);
    if (prev) {
      byPath.set(wire.path, { ...prev, path: wire.path });
    } else {
      byPath.set(wire.path, wire);
    }
  }
  return [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Un gruppo per task Backend Call collegato.
 */
export function collectBackendReceiveLeavesByTask(
  backendTaskIds: readonly string[],
  getTask: (taskId: string) => Task | null | undefined
): BackendReceiveLeavesGroup[] {
  const out: BackendReceiveLeavesGroup[] = [];
  for (const id of backendTaskIds) {
    const backendTaskId = String(id ?? '').trim();
    if (!backendTaskId) continue;
    const task = getTask(backendTaskId);
    if (!task || task.type !== TaskType.BackendCall) continue;
    const leaves = mergeReceiveLeaves(
      collectBackendReceiveLeavesFromTask(task),
      collectWireReceivePathsFromTask(task)
    );
    if (leaves.length === 0) continue;
    const toolName = deriveExportedToolName(task).trim() || backendTaskId;
    out.push({ backendTaskId, toolName, leaves });
  }
  return out.sort((a, b) => a.toolName.localeCompare(b.toolName));
}

/** Path piatti per compile IA / allowlist. */
export function collectReceivePathsFromGroups(
  groups: readonly BackendReceiveLeavesGroup[]
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const g of groups) {
    for (const leaf of g.leaves) {
      const p = leaf.path.trim();
      if (!p || seen.has(p)) continue;
      seen.add(p);
      out.push(p);
    }
  }
  return out.sort((a, b) => a.localeCompare(b));
}
