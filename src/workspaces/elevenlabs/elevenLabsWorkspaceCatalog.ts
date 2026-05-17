/**
 * Filtri e helper per voci `backendCatalog.manualEntries` create dal workspace ElevenLabs.
 */

import type { ElevenLabsWorkspaceToolKind, ManualCatalogEntry } from '@domain/backendCatalog/catalogTypes';

export function isElevenLabsWorkspaceCatalogEntry(
  entry: ManualCatalogEntry
): entry is ManualCatalogEntry & { elevenLabsWorkspaceTool: NonNullable<ManualCatalogEntry['elevenLabsWorkspaceTool']> } {
  return Boolean(entry.elevenLabsWorkspaceTool?.kind);
}

export function filterElevenLabsWorkspaceEntries(
  entries: readonly ManualCatalogEntry[],
  filter: {
    kind?: ElevenLabsWorkspaceToolKind;
    scope: 'agent' | 'node';
    nodeId?: string;
    agentId?: string;
  }
): ManualCatalogEntry[] {
  return entries.filter((e) => {
    const meta = e.elevenLabsWorkspaceTool;
    if (!meta) return false;
    if (filter.kind && meta.kind !== filter.kind) return false;
    if (meta.scope !== filter.scope) return false;
    if (filter.scope === 'node' && filter.nodeId && meta.nodeId !== filter.nodeId) return false;
    if (filter.agentId && meta.agentId && meta.agentId !== filter.agentId) return false;
    return true;
  });
}
