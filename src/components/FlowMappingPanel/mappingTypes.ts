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
  /** Promised variable GUID when wired from a flow row or wizard (stable for runtime). */
  variableRefId?: string;
  /** Flow-local translation key; display string lives in FlowDocument.meta.translations[labelKey]. */
  labelKey?: string;
  /** Backend: human description for tooltip / docs. */
  fieldDescription?: string;
  /** Backend: example or allowed values (shown in grid; first value may surface as hint). */
  sampleValues?: string[];
}

export function createMappingEntry(partial: Partial<MappingEntry> & Pick<MappingEntry, 'internalPath'>): MappingEntry {
  const id =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `me_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const vid = partial.variableRefId?.trim();
  return {
    id,
    internalPath: partial.internalPath.trim(),
    apiField: partial.apiField ?? '',
    linkedVariable: partial.linkedVariable?.trim() ?? (vid ? vid : ''),
    externalName: partial.externalName ?? partial.internalPath.trim(),
    ...(partial.fieldDescription != null ? { fieldDescription: partial.fieldDescription } : {}),
    ...(partial.sampleValues != null ? { sampleValues: partial.sampleValues } : {}),
    ...(vid ? { variableRefId: vid } : {}),
  };
}
