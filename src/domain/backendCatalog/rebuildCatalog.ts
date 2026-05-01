/**
 * Ricostruzione vista catalogo (solo CPU): merge derivati + manuali per chiave canonica.
 */

import type { CatalogBinding, CatalogRow, ManualCatalogEntry } from './catalogTypes';
import { canonicalKey } from './canonicalKey';
import type { DerivedBackendRef } from './catalogTypes';

function bindingFromDerived(ref: DerivedBackendRef): CatalogBinding {
  return {
    bindingId: `${ref.source}:${ref.taskId}`,
    source: ref.source,
    taskId: ref.taskId,
    endpointUrl: ref.endpointUrlForImport,
    method: ref.method,
    frozenMeta: ref.frozenMeta,
    lastStructuralEditAt: ref.lastStructuralEditAt,
  };
}

function bindingFromManual(entry: ManualCatalogEntry): CatalogBinding {
  const method = (entry.method || 'GET').toUpperCase();
  return {
    bindingId: `manual:${entry.id}`,
    source: 'manual',
    manualEntryId: entry.id,
    endpointUrl: entry.endpointUrl,
    method,
    frozenMeta: {
      lastImportedAt: entry.frozenMeta.lastImportedAt,
      specSourceUrl: entry.frozenMeta.specSourceUrl,
      contentHash: entry.frozenMeta.contentHash,
      importState: entry.frozenMeta.importState,
      lastError: entry.frozenMeta.lastError,
      structuralFingerprintAtLastOkImport: entry.frozenMeta.structuralFingerprintAtLastOkImport,
    },
    lastStructuralEditAt: entry.lastStructuralEditAt,
  };
}

export interface RebuildCatalogInput {
  derived: DerivedBackendRef[];
  manualEntries: ManualCatalogEntry[];
}

export interface RebuildCatalogResult {
  rows: CatalogRow[];
}

/**
 * Merge per {@link canonicalKey}: una riga, più binding con badge sorgente.
 */
export function rebuildCatalog(input: RebuildCatalogInput): RebuildCatalogResult {
  const manualEntries = input.manualEntries ?? [];
  const map = new Map<string, { bindings: CatalogBinding[]; labels: string[] }>();

  for (const d of input.derived) {
    const b = bindingFromDerived(d);
    const key = canonicalKey({
      method: b.method,
      endpointUrl: b.endpointUrl,
      operationId: d.operationId,
    });
    const cur = map.get(key) ?? { bindings: [], labels: [] };
    cur.bindings.push(b);
    cur.labels.push(d.label);
    map.set(key, cur);
  }

  for (const m of manualEntries) {
    const b = bindingFromManual(m);
    const key = canonicalKey({
      method: b.method,
      endpointUrl: b.endpointUrl,
      operationId: m.operationId,
    });
    const cur = map.get(key) ?? { bindings: [], labels: [] };
    cur.bindings.push(b);
    cur.labels.push(m.label);
    map.set(key, cur);
  }

  const rows: CatalogRow[] = [];
  for (const [key, { bindings, labels }] of map) {
    const sources = {
      graph: bindings.some((x) => x.source === 'graph'),
      tools: bindings.some((x) => x.source === 'tools'),
      manual: bindings.some((x) => x.source === 'manual'),
    };
    const first = bindings[0];
    const labelPick =
      labels.find((_, i) => bindings[i]?.source === 'manual') ||
      labels.find((_, i) => bindings[i]?.source === 'graph') ||
      labels[0] ||
      key;
    rows.push({
      key,
      sources,
      method: first.method,
      pathnameDisplay: safePathDisplay(first.endpointUrl),
      label: labelPick,
      bindings,
    });
  }

  rows.sort((a, b) => a.key.localeCompare(b.key));
  return { rows };
}

function safePathDisplay(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname + (u.search || '');
  } catch {
    return url;
  }
}
