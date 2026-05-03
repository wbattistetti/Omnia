/**
 * Backend manuali nel progetto (`project.backendCatalog.manualEntries`) condividono l’id del task Backend Call:
 * sono la fonte UX della tab Dock «Backends» e devono concorrere ai tool ConvAI insieme a `convaiBackendToolTaskIds`.
 */

/** Ordine: prima `primary`, poi `secondary`; dedup preservando l’ordine di prima apparizione. */
export function mergeConvaiBackendToolIdLists(
  primary: readonly string[],
  secondary: readonly string[]
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of [...primary, ...secondary]) {
    const id = String(raw ?? '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * Estrae gli id task Backend Call dalle voci catalogo manuale in un blob progetto (tipicamente `ProjectData`).
 */
export function extractManualCatalogBackendTaskIdsFromProjectData(projectData: unknown): string[] {
  if (!projectData || typeof projectData !== 'object') return [];
  const bc = (projectData as { backendCatalog?: { manualEntries?: unknown } }).backendCatalog;
  const entries = bc?.manualEntries;
  if (!Array.isArray(entries)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const e of entries) {
    if (!e || typeof e !== 'object') continue;
    const id = String((e as { id?: string }).id ?? '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}
