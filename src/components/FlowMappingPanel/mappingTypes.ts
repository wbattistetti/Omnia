/**
 * Flat mapping rows stored in panel state; tree is derived via mappingTreeUtils.
 * Display text for variables is never stored here — only `flow.meta.translations[var:<guid>]`.
 */

export interface MappingEntry {
  id: string;
  /** Tree order + backend wire name (internalName); not a human label. */
  wireKey: string;
  /** Backend: wire name (Swagger / free text). */
  apiField: string;
  /** Promised variable GUID when wired from a flow row or wizard (stable for runtime). */
  variableRefId?: string;
  /** Optional key into `flow.meta.translations` — canonical `var:<uuid>` for variable-linked rows. */
  labelKey?: string;
  /** Backend: human description for tooltip / docs. */
  fieldDescription?: string;
  /** Backend: example or allowed values (shown in grid; first value may surface as hint). */
  sampleValues?: string[];
  /** Solo UI: descrizione locale ≠ snapshot OpenAPI (non persistita sul task). */
  openapiDescriptionDrift?: boolean;
  /** Solo UI: testo OpenAPI corrente per tooltip / pannello confronto. */
  openapiDescriptionHint?: string;
}

export function createMappingEntry(partial: Partial<MappingEntry> & Pick<MappingEntry, 'wireKey'>): MappingEntry {
  const id =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `me_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const vid = partial.variableRefId?.trim();
  const lk = partial.labelKey?.trim();
  return {
    id,
    wireKey: partial.wireKey.trim(),
    apiField: partial.apiField ?? '',
    ...(partial.fieldDescription != null ? { fieldDescription: partial.fieldDescription } : {}),
    ...(partial.sampleValues != null ? { sampleValues: partial.sampleValues } : {}),
    ...(partial.openapiDescriptionDrift !== undefined ? { openapiDescriptionDrift: partial.openapiDescriptionDrift } : {}),
    ...(partial.openapiDescriptionHint !== undefined ? { openapiDescriptionHint: partial.openapiDescriptionHint } : {}),
    ...(vid ? { variableRefId: vid } : {}),
    ...(lk ? { labelKey: lk } : {}),
  };
}

/**
 * Stable tree segment for interface rows when no explicit dot-path is provided.
 * Must be non-empty so `buildMappingTree` does not drop the row.
 */
export function defaultWireKeyForInterfaceVariable(variableRefId: string): string {
  const vid = String(variableRefId || '').trim();
  if (!vid) return 'iface_unknown';
  return `iface_${vid.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}

/**
 * Flow / subflow interface row: identity is {@link MappingEntry.variableRefId}; human label from `flow.meta.translations` at render.
 * `wireKey` is the trie path (optional; defaults to a stable slug per variable so the mapping tree always shows the row).
 */
export function createFlowInterfaceMappingEntry(partial: {
  variableRefId: string;
  labelKey?: string;
  /** Dot path for the mapping tree; omit to use {@link defaultWireKeyForInterfaceVariable}. */
  wireKey?: string;
}): MappingEntry {
  const id =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `me_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const vid = String(partial.variableRefId || '').trim();
  const lk = partial.labelKey?.trim();
  const wireKey = String(partial.wireKey ?? '').trim() || defaultWireKeyForInterfaceVariable(vid);
  return {
    id,
    wireKey,
    apiField: '',
    variableRefId: vid,
    ...(lk ? { labelKey: lk } : {}),
  };
}
