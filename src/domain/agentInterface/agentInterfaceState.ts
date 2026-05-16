/**
 * Agent task interface contract: INPUT/OUTPUT parameter lists (wireKey-centric).
 * Persisted on the AI Agent task as `agentInterfaceJson`.
 */

import type { MappingEntry } from '@components/FlowMappingPanel/mappingTypes';
import { createMappingEntry } from '@components/FlowMappingPanel/mappingTypes';

export const AGENT_INTERFACE_SCHEMA_VERSION = 1 as const;

export type AgentInterfaceParamSide = 'send' | 'receive';

/** Single row in persisted agent interface JSON. */
export type AgentInterfaceParamRow = {
  id: string;
  wireKey: string;
  variableRefId?: string;
  /** Catalog backend task that last supplied this wireKey (stale detection). */
  sourceBackendTaskId?: string;
  sourceSide?: AgentInterfaceParamSide;
};

export type AgentInterfacePersisted = {
  schemaVersion: typeof AGENT_INTERFACE_SCHEMA_VERSION;
  input: AgentInterfaceParamRow[];
  output: AgentInterfaceParamRow[];
};

export const EMPTY_AGENT_INTERFACE: AgentInterfacePersisted = {
  schemaVersion: AGENT_INTERFACE_SCHEMA_VERSION,
  input: [],
  output: [],
};

function normalizeRow(raw: unknown): AgentInterfaceParamRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const id = String(o.id ?? '').trim();
  const wireKey = String(o.wireKey ?? '').trim();
  if (!id || !wireKey) return null;
  const variableRefId = String(o.variableRefId ?? '').trim();
  const sourceBackendTaskId = String(o.sourceBackendTaskId ?? '').trim();
  const sideRaw = String(o.sourceSide ?? '').trim();
  const sourceSide =
    sideRaw === 'send' || sideRaw === 'receive' ? (sideRaw as AgentInterfaceParamSide) : undefined;
  return {
    id,
    wireKey,
    ...(variableRefId ? { variableRefId } : {}),
    ...(sourceBackendTaskId ? { sourceBackendTaskId } : {}),
    ...(sourceSide ? { sourceSide } : {}),
  };
}

/** Parse `Task.agentInterfaceJson` (tolerant). */
export function parseAgentInterfaceJson(raw: string | undefined | null): AgentInterfacePersisted {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return { ...EMPTY_AGENT_INTERFACE, input: [], output: [] };
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!parsed || typeof parsed !== 'object') return { ...EMPTY_AGENT_INTERFACE };
    const o = parsed as Record<string, unknown>;
    const input = Array.isArray(o.input)
      ? o.input.map(normalizeRow).filter((r): r is AgentInterfaceParamRow => r != null)
      : [];
    const output = Array.isArray(o.output)
      ? o.output.map(normalizeRow).filter((r): r is AgentInterfaceParamRow => r != null)
      : [];
    return {
      schemaVersion: AGENT_INTERFACE_SCHEMA_VERSION,
      input,
      output,
    };
  } catch {
    return { ...EMPTY_AGENT_INTERFACE };
  }
}

export function serializeAgentInterfaceJson(state: AgentInterfacePersisted): string {
  return JSON.stringify({
    schemaVersion: AGENT_INTERFACE_SCHEMA_VERSION,
    input: state.input,
    output: state.output,
  });
}

export function agentInterfaceRowsToMappingEntries(rows: AgentInterfaceParamRow[]): MappingEntry[] {
  return rows.map((row) =>
    createMappingEntry({
      id: row.id,
      wireKey: row.wireKey,
      ...(row.variableRefId ? { variableRefId: row.variableRefId } : {}),
      apiField: '',
    })
  );
}

export function mappingEntriesToAgentInterfaceRows(entries: MappingEntry[]): AgentInterfaceParamRow[] {
  return entries
    .map((e) => {
      const wireKey = e.wireKey.trim();
      if (!wireKey) return null;
      const row: AgentInterfaceParamRow = {
        id: e.id,
        wireKey,
      };
      const vid = e.variableRefId?.trim();
      if (vid) row.variableRefId = vid;
      const meta = e as MappingEntry & {
        sourceBackendTaskId?: string;
        sourceSide?: AgentInterfaceParamSide;
      };
      if (meta.sourceBackendTaskId?.trim()) row.sourceBackendTaskId = meta.sourceBackendTaskId.trim();
      if (meta.sourceSide === 'send' || meta.sourceSide === 'receive') row.sourceSide = meta.sourceSide;
      return row;
    })
    .filter((r): r is AgentInterfaceParamRow => r != null);
}
