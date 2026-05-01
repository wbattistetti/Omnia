/**
 * Audit append-only in memoria (progetto): solo push; violazioni in dev.
 */

import type { CatalogAuditEntry } from '../../domain/backendCatalog/catalogTypes';
import { AUDIT_ENTRY_SCHEMA_VERSION } from '../../domain/backendCatalog/catalogSchema';
import { generateSafeGuid } from '../../utils/idGenerator';

export function appendAuditEntry(
  log: CatalogAuditEntry[],
  partial: Omit<CatalogAuditEntry, 'id' | 'schemaVersion' | 'ts'>
): CatalogAuditEntry[] {
  const entry: CatalogAuditEntry = {
    schemaVersion: AUDIT_ENTRY_SCHEMA_VERSION,
    id: generateSafeGuid(),
    ts: new Date().toISOString(),
    ...partial,
  };
  if (!Array.isArray(log)) return [entry];
  return [...log, entry];
}
