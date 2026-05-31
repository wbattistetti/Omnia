/**
 * Contratti slot_id ↔ backend: merge righe path, tool ConvAI, subset per use case.
 */

import type { Task } from '@types/taskTypes';
import { TaskType } from '@types/taskTypes';
import { deriveExportedToolName } from '@domain/iaAgentTools/backendToolDerivation';
import { collectBackendReceiveLeavesFromTask } from '@domain/openApi/backendReceiveParamCatalog';
import type {
  AgentBackendOutputSlotBindings,
  SlotBackendContract,
  SlotBackendContractJson,
  SlotBackendContractMap,
} from './types';
import { parseBaseSlotIdFromToken } from './parseTokenSlotId';

export interface BackendToolCompileContext {
  backendTaskId: string;
  toolName: string;
  receivePaths: string[];
  /** Albero nidificato dei path RECEIVE (per prompt IA). */
  receivePathTree: Record<string, unknown>;
  sendPaths: string[];
}

/** Costruisce un oggetto ad albero da path puntati (es. `constraints.horizon.end`). */
export function buildReceivePathTree(paths: readonly string[]): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  for (const raw of paths) {
    const path = String(raw ?? '').trim();
    if (!path) continue;
    const parts = path.split('.').filter(Boolean);
    let node = root;
    for (let i = 0; i < parts.length; i++) {
      const seg = parts[i]!;
      if (i === parts.length - 1) {
        node[seg] = path;
      } else {
        const next = node[seg];
        if (!next || typeof next !== 'object' || Array.isArray(next)) {
          node[seg] = {};
        }
        node = node[seg] as Record<string, unknown>;
      }
    }
  }
  return root;
}

/** Contesto per prompt IA compile (nomi tool reali ConvAI). */
export function collectBackendToolCompileContexts(
  backendTaskIds: readonly string[],
  getTask: (taskId: string) => Task | null | undefined
): BackendToolCompileContext[] {
  const out: BackendToolCompileContext[] = [];
  for (const backendTaskId of backendTaskIds) {
    const id = String(backendTaskId ?? '').trim();
    if (!id) continue;
    const task = getTask(id);
    if (!task || task.type !== TaskType.BackendCall) continue;
    const toolName = deriveExportedToolName(task).trim();
    if (!toolName) continue;
    const outputs = Array.isArray((task as Task & { outputs?: unknown[] }).outputs)
      ? (task as Task & { outputs: Array<{ apiField?: string }> }).outputs
      : [];
    const inputs = Array.isArray((task as Task & { inputs?: unknown[] }).inputs)
      ? (task as Task & { inputs: Array<{ apiParam?: string }> }).inputs
      : [];
    const wirePaths = outputs.map((o) => String(o.apiField ?? '').trim()).filter(Boolean);
    const openapiPaths = collectBackendReceiveLeavesFromTask(task).map((l) => l.path);
    const receivePaths = [
      ...new Set([...openapiPaths, ...wirePaths].map((p) => p.trim()).filter(Boolean)),
    ].sort((a, b) => a.localeCompare(b));
    out.push({
      backendTaskId: id,
      toolName,
      receivePaths,
      receivePathTree: buildReceivePathTree(receivePaths),
      sendPaths: inputs.map((i) => String(i.apiParam ?? '').trim()).filter(Boolean),
    });
  }
  return out;
}

/**
 * Ricostruisce `slotContracts` dalle righe path + nomi tool (euristica post-righe).
 */
export function syncSlotContractsFromRows(
  bindings: AgentBackendOutputSlotBindings,
  getTask: (taskId: string) => Task | null | undefined
): SlotBackendContract[] {
  const bySlot = new Map<string, SlotBackendContract>();
  const prevBySlot = new Map(
    (bindings.slotContracts ?? []).map((c) => [c.slotId, c] as const)
  );

  for (const row of bindings.rows) {
    const slotId = row.slotId.trim().toLowerCase();
    if (!slotId) continue;
    const task = getTask(row.backendTaskId);
    const toolName =
      task && task.type === TaskType.BackendCall ? deriveExportedToolName(task).trim() : '';
    const prev = prevBySlot.get(slotId);
    if (prev?.approved) {
      bySlot.set(slotId, prev);
      continue;
    }
    const existing = bySlot.get(slotId);
    if (existing && existing.approved) continue;
    bySlot.set(slotId, {
      slotId,
      toolName: toolName || prev?.toolName || existing?.toolName || '',
      backendTaskId: row.backendTaskId,
      receive: row.apiPath,
      ...(row.format ? { format: row.format } : {}),
      ...(prev?.send?.length ? { send: prev.send } : existing?.send ? { send: existing.send } : {}),
      approved: prev?.approved ?? existing?.approved,
    });
  }
  return [...bySlot.values()];
}

export function mergeSlotContractsFromProposal(
  current: readonly SlotBackendContract[],
  proposed: readonly Array<{
    slotId: string;
    toolName: string;
    receive: string;
    send?: string[];
    format?: string;
    backendTaskId?: string;
  }>,
  defaultBackendTaskId: string
): SlotBackendContract[] {
  const bySlot = new Map(current.map((c) => [c.slotId, { ...c }]));
  for (const p of proposed) {
    const slotId = p.slotId.trim().toLowerCase();
    if (!slotId) continue;
    const prev = bySlot.get(slotId);
    if (prev?.approved) continue;
    const send = Array.isArray(p.send) ? p.send.map((s) => String(s).trim()).filter(Boolean) : undefined;
    bySlot.set(slotId, {
      slotId,
      toolName: String(p.toolName ?? prev?.toolName ?? '').trim(),
      backendTaskId: String(p.backendTaskId ?? prev?.backendTaskId ?? defaultBackendTaskId).trim(),
      receive: String(p.receive ?? prev?.receive ?? '').trim(),
      ...(send?.length ? { send } : prev?.send?.length ? { send: prev.send } : {}),
      ...(p.format ? { format: p.format } : prev?.format ? { format: prev.format } : {}),
      approved: prev?.approved,
    });
  }
  return [...bySlot.values()];
}

export function slotContractMapFromContracts(
  contracts: readonly SlotBackendContract[]
): SlotBackendContractMap {
  const out: SlotBackendContractMap = {};
  for (const c of contracts) {
    if (!c.slotId || !c.receive.trim()) continue;
    out[c.slotId] = {
      tool: c.toolName,
      receive: c.receive,
      ...(c.send?.length ? { send: [...c.send] } : {}),
      ...(c.format ? { format: c.format } : {}),
    };
  }
  return out;
}

/** Solo slot usati nelle varianti di uno use case (evita rumore nel JSON UC). */
export function subsetSlotBackendContractForSlotIds(
  contracts: readonly SlotBackendContract[],
  slotIds: readonly string[]
): SlotBackendContractMap {
  const want = new Set(slotIds.map((s) => s.trim().toLowerCase()).filter(Boolean));
  const full = slotContractMapFromContracts(contracts);
  const out: SlotBackendContractMap = {};
  for (const id of want) {
    if (full[id]) out[id] = full[id];
  }
  return out;
}

export function collectSlotIdsFromCompiledTokens(tokens: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const token of tokens) {
    const slotId = parseBaseSlotIdFromToken(token);
    if (!slotId || seen.has(slotId)) continue;
    seen.add(slotId);
    out.push(slotId);
  }
  return out;
}
