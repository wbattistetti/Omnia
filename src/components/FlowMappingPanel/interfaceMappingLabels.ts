/**
 * Interface row display: unified policy — leaf labels on this canvas (`flowInterfaceOutput`).
 */

import type { WorkspaceState } from '@flows/FlowTypes';
import { variableCreationService } from '../../services/VariableCreationService';
import { getActiveFlowMetaTranslationsFlattened } from '../../utils/activeFlowTranslations';
import { getProjectTranslationsTable } from '../../utils/projectTranslationsRegistry';
import { interfaceOutputLeafDisplayName, resolveVariableDisplayName } from '../../utils/resolveVariableDisplayName';
import type { MappingEntry } from './mappingTypes';

/**
 * Label shown on an Interface tree row: local segment in the trie (e.g. `json` under `agenda`),
 * or translated variable name when `variableRefId` is set.
 */
export function getInterfaceTreeRowDisplayLabel(
  entry: MappingEntry | undefined,
  treeSegment: string,
  projectId: string | undefined,
  opts?: { flowCanvasId?: string; flows?: WorkspaceState['flows'] }
): string {
  if (!entry) return treeSegment;
  const vid = entry.variableRefId?.trim();
  if (vid) {
    return getInterfaceLeafDisplayName(entry, projectId, opts);
  }
  return treeSegment.trim() || entry.wireKey.trim();
}

/** Single label for Interface tree rows: translations + optional live `flows` / task row fallback. */
export function getInterfaceLeafDisplayName(
  entry: MappingEntry,
  _projectId: string | undefined,
  opts?: { flowCanvasId?: string; flows?: WorkspaceState['flows'] }
): string {
  void _projectId;
  const vid = entry.variableRefId?.trim();
  if (!vid) {
    return entry.wireKey.trim();
  }
  return interfaceOutputLeafDisplayName(vid, opts?.flowCanvasId, opts?.flows, getProjectTranslationsTable());
}

/**
 * Registers GUID in the flow scope; label text must already live in `flow.meta.translations`.
 */
export function ensureFlowVariableBindingForInterfaceRow(
  projectId: string | undefined,
  flowCanvasId: string | undefined,
  variableRefId: string | undefined
): void {
  const pid = projectId?.trim();
  const fid = flowCanvasId?.trim();
  const vid = variableRefId?.trim();
  if (!pid || !fid || !vid) return;
  const tbl = getActiveFlowMetaTranslationsFlattened();
  const clean = resolveVariableDisplayName(vid, 'flowCanvasToken', {
    flowMetaTranslations: tbl,
    compiledTranslations: getProjectTranslationsTable(),
  });
  variableCreationService.ensureManualVariableWithId(pid, vid, clean, {
    scope: 'flow',
    scopeFlowId: fid,
  });
}

/** Skip duplicate drops in the same zone (same variable GUID). */
export function shouldSkipInterfaceDuplicate(
  existing: { variableRefId?: string; wireKey: string }[],
  entry: { variableRefId?: string; wireKey: string }
): boolean {
  const vid = entry.variableRefId?.trim();
  if (vid) {
    return existing.some((e) => e.variableRefId?.trim() === vid);
  }
  const path = entry.wireKey.trim();
  return existing.some((e) => e.wireKey.trim() === path);
}
