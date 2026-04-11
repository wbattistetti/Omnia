/**
 * Interface row display: only `flow.meta.translations` for the active canvas (flattened), then GUID.
 */

import { variableCreationService } from '../../services/VariableCreationService';
import { getActiveFlowMetaTranslationsFlattened } from '../../utils/activeFlowTranslations';
import { getVariableLabel } from '../../utils/getVariableLabel';
import type { MappingEntry } from './mappingTypes';

/** Single label for Interface tree rows: flow translation by labelKey, else `var:<guid>`, else GUID. */
export function getInterfaceLeafDisplayName(entry: MappingEntry, _projectId: string | undefined): string {
  void _projectId;
  const vid = entry.variableRefId?.trim();
  if (!vid) {
    return '';
  }
  const tbl = getActiveFlowMetaTranslationsFlattened();
  const lk = entry.labelKey?.trim();
  if (lk && tbl[lk] != null && String(tbl[lk]).trim() !== '') {
    return String(tbl[lk]).trim();
  }
  return getVariableLabel(vid, tbl);
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
  const clean = getVariableLabel(vid, tbl);
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
