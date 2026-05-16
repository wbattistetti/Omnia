/**
 * Aggregates SEND/RECEIVE parameter names from manual catalog backend tasks for the agent palette.
 */

import { taskRepository } from '@services/TaskRepository';
import type { ManualCatalogEntry } from '@domain/backendCatalog/catalogTypes';
import type { AgentInterfaceParamSide } from './agentInterfaceState';

export type AgentBackendSignatureParam = {
  wireKey: string;
  side: AgentInterfaceParamSide;
  backendTaskId: string;
  backendLabel: string;
};

type BackendIoRow = { internalName?: string };

function readIo(taskId: string): { inputs: BackendIoRow[]; outputs: BackendIoRow[] } {
  const t = taskRepository.getTask(taskId) as {
    inputs?: BackendIoRow[];
    outputs?: BackendIoRow[];
  } | null;
  return {
    inputs: Array.isArray(t?.inputs) ? t.inputs : [],
    outputs: Array.isArray(t?.outputs) ? t.outputs : [],
  };
}

/**
 * One row per (backend, side, wireKey) from catalog manual entries.
 */
export function collectAgentBackendSignatures(
  manualEntries: readonly ManualCatalogEntry[]
): AgentBackendSignatureParam[] {
  const out: AgentBackendSignatureParam[] = [];
  for (const entry of manualEntries) {
    const backendTaskId = String(entry.id ?? '').trim();
    if (!backendTaskId) continue;
    const backendLabel =
      entry.label.trim() || entry.endpointUrl.trim() || backendTaskId.slice(0, 8);
    const { inputs, outputs } = readIo(backendTaskId);
    const seen = new Set<string>();
    for (const row of inputs) {
      const wireKey = String(row.internalName ?? '').trim();
      if (!wireKey) continue;
      const key = `send:${backendTaskId}:${wireKey}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ wireKey, side: 'send', backendTaskId, backendLabel });
    }
    for (const row of outputs) {
      const wireKey = String(row.internalName ?? '').trim();
      if (!wireKey) continue;
      const key = `receive:${backendTaskId}:${wireKey}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ wireKey, side: 'receive', backendTaskId, backendLabel });
    }
  }
  return out;
}
