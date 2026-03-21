/**
 * Flat mapping rows stored in panel state; tree is derived via mappingTreeUtils.
 */

export interface MappingEntry {
  id: string;
  /** Dot path / internal name (e.g. data di nascita.giorno). */
  internalPath: string;
  /** Backend: wire name (Swagger / free text). */
  apiField: string;
  /** Backend: linked variable label or id display. */
  linkedVariable: string;
  /** Interface: exposed parameter name (defaults to internal when dropped). */
  externalName: string;
}

export function createMappingEntry(partial: Partial<MappingEntry> & Pick<MappingEntry, 'internalPath'>): MappingEntry {
  const id =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `me_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  return {
    id,
    internalPath: partial.internalPath.trim(),
    apiField: partial.apiField ?? '',
    linkedVariable: partial.linkedVariable ?? '',
    externalName: partial.externalName ?? partial.internalPath.trim(),
  };
}
