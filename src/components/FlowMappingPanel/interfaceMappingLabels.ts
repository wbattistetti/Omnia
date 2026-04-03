/**
 * Derives Interface row labels from flow row text + variable GUID: prefers project translations,
 * otherwise uses linkedVariable / externalName / path.
 */

import { variableCreationService } from '../../services/VariableCreationService';
import { getVariableLabel } from '../../utils/getVariableLabel';
import { getProjectTranslationsTable } from '../../utils/projectTranslationsRegistry';
import type { MappingEntry } from './mappingTypes';

/** Single label for Interface tree rows: translation by GUID, else linkedVariable / externalName / path. */
export function getInterfaceLeafDisplayName(
  entry: MappingEntry,
  projectId: string | undefined
): string {
  const pid = projectId?.trim();
  const vid = entry.variableRefId?.trim();
  if (pid && vid) {
    const fromTr = getVariableLabel(vid, getProjectTranslationsTable());
    if (fromTr) return fromTr;
  }
  return (
    entry.linkedVariable?.trim() ||
    entry.externalName?.trim() ||
    entry.internalPath.trim()
  );
}

export function computeInterfaceEntryLabels(
  projectId: string | undefined,
  variableRefId: string | undefined,
  rowLabel: string,
  internalPath: string
): { externalName: string; linkedVariable: string } {
  const pid = projectId?.trim();
  const vid = variableRefId?.trim();
  const fromStore = pid && vid ? getVariableLabel(vid, getProjectTranslationsTable()) : '';
  const cleanRow = variableCreationService.normalizeTaskLabel(
    (rowLabel || internalPath || 'field').trim()
  );
  const externalName = (fromStore || cleanRow || internalPath).trim();
  const linkedVariable = (fromStore || cleanRow || vid || '').trim();
  return { externalName, linkedVariable };
}

/**
 * Registers GUID → normalized label in the flow scope so translations and UI stay aligned.
 */
export function ensureFlowVariableBindingForInterfaceRow(
  projectId: string | undefined,
  flowCanvasId: string | undefined,
  variableRefId: string | undefined,
  rowLabel: string,
  internalPath: string
): void {
  const pid = projectId?.trim();
  const fid = flowCanvasId?.trim();
  const vid = variableRefId?.trim();
  if (!pid || !fid || !vid) return;
  const clean = variableCreationService.normalizeTaskLabel(
    (rowLabel || internalPath || 'field').trim()
  );
  variableCreationService.ensureManualVariableWithId(pid, vid, clean, {
    scope: 'flow',
    scopeFlowId: fid,
  });
}

/** Skip duplicate drops in the same zone (same variable GUID or same path if no GUID). */
export function shouldSkipInterfaceDuplicate(
  existing: { variableRefId?: string; internalPath: string }[],
  entry: { variableRefId?: string; internalPath: string }
): boolean {
  const vid = entry.variableRefId?.trim();
  if (vid) {
    return existing.some((e) => e.variableRefId?.trim() === vid);
  }
  const path = entry.internalPath.trim();
  return existing.some((e) => e.internalPath.trim() === path);
}
