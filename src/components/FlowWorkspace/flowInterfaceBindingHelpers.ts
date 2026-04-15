/**
 * Helpers: quali variabili sono legate a Input/Output (flowInterface) e rimozione sicura di un legame.
 */

import type { WorkspaceState } from '@flows/FlowTypes';
import type { MappingEntry } from '../FlowMappingPanel/mappingTypes';
import {
  validateRemovalOfInterfaceOutputRow,
  type ReferenceLocation,
} from '../../services/subflowVariableReferenceScan';

export function collectFlowInterfaceBoundVariableIds(
  flowInterface: { input: MappingEntry[]; output: MappingEntry[] } | undefined
): Set<string> {
  const s = new Set<string>();
  if (!flowInterface) return s;
  for (const e of flowInterface.input) {
    const id = e.variableRefId?.trim();
    if (id) s.add(id);
  }
  for (const e of flowInterface.output) {
    const id = e.variableRefId?.trim();
    if (id) s.add(id);
  }
  return s;
}

export type RemoveInterfaceBindingResult =
  | { ok: true; nextInput: MappingEntry[]; nextOutput: MappingEntry[] }
  | { ok: false; references: ReferenceLocation[] };

/**
 * Rimuove tutte le righe interface con questo variableRefId (input e/o output).
 * Per output applica {@link validateRemovalOfInterfaceOutputRow} se necessario.
 */
export function tryRemoveVariableRefFromFlowInterface(
  flows: WorkspaceState['flows'],
  flowId: string,
  variableRefId: string,
  projectId: string | undefined,
  translations: Record<string, string>,
  conditionPayloads?: Array<{ id: string; label: string; text: string }>
): RemoveInterfaceBindingResult {
  const iface = flows[flowId]?.meta?.flowInterface;
  if (!iface) {
    return { ok: true, nextInput: [], nextOutput: [] };
  }
  const vid = String(variableRefId || '').trim();
  if (!vid) {
    return { ok: true, nextInput: [...iface.input], nextOutput: [...iface.output] };
  }

  const pid = String(projectId || '').trim();
  const inOutput = iface.output.some((e) => e.variableRefId?.trim() === vid);

  if (inOutput && pid) {
    const v = validateRemovalOfInterfaceOutputRow(pid, flowId, vid, flows, translations, conditionPayloads);
    if (!v.ok) {
      return { ok: false, references: v.references };
    }
  }

  const nextInput = iface.input.filter((e) => e.variableRefId?.trim() !== vid);
  const nextOutput = iface.output.filter((e) => e.variableRefId?.trim() !== vid);
  return { ok: true, nextInput, nextOutput };
}
