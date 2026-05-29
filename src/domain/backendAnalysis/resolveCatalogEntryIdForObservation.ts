/**
 * Associa un'osservazione di review al backend catalogo più plausibile.
 */

import type { ManualCatalogEntry } from '@domain/backendCatalog/catalogTypes';
import type { BackendAnalysisDocumentV2 } from './backendAnalysisDocumentV2';

function endpointSlugFromUrl(url: string | undefined): string {
  const raw = String(url ?? '').trim();
  if (!raw) return '';
  try {
    const parts = new URL(raw).pathname.split('/').filter(Boolean);
    return (parts[parts.length - 1] ?? '').toLowerCase();
  } catch {
    return (raw.split('/').filter(Boolean).pop() ?? '').toLowerCase();
  }
}

/**
 * Restituisce catalogEntryId se univoco o se il testo cita label/slug/parametri noti.
 */
export function resolveCatalogEntryIdForObservation(
  observationText: string,
  manualEntries: readonly ManualCatalogEntry[],
  document: BackendAnalysisDocumentV2
): string | null {
  if (manualEntries.length === 1) return manualEntries[0]!.id;

  const text = observationText.toLowerCase();
  const scored = new Map<string, number>();

  const bump = (id: string, weight: number) => {
    scored.set(id, (scored.get(id) ?? 0) + weight);
  };

  for (const entry of manualEntries) {
    const label = (entry.label ?? '').trim().toLowerCase();
    const slug = endpointSlugFromUrl(entry.endpointUrl);
    if (label.length >= 3 && text.includes(label)) bump(entry.id, 4);
    if (slug.length >= 3 && text.includes(slug)) bump(entry.id, 3);
  }

  for (const [id, backend] of Object.entries(document.backends)) {
    const label = backend.displayLabel.trim().toLowerCase();
    if (label.length >= 3 && text.includes(label)) bump(id, 4);
    for (const pk of Object.keys(backend.parameters)) {
      const key = pk.toLowerCase();
      if (key.length >= 2 && text.includes(key)) bump(id, 2);
    }
  }

  if (scored.size === 0) return null;

  const ranked = [...scored.entries()].sort((a, b) => b[1] - a[1]);
  const top = ranked[0];
  if (!top) return null;
  if (ranked.length === 1 || (ranked[1]?.[1] ?? 0) < top[1]) return top[0];
  return null;
}
