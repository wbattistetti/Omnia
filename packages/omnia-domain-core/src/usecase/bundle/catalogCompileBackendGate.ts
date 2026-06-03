/**
 * Gate compile catalogo: mappatura IA legata ai backend (RECEIVE/SEND) è opzionale.
 */

export interface CatalogCompileIaMappingInputs {
  surfaceCount: number;
  phraseTokenCount: number;
}

/** True se nel catalogo ci sono superfici/token da arricchire (lessico o frasi). */
export function catalogHasCompileMappingInputs(
  inputs: CatalogCompileIaMappingInputs
): boolean {
  return inputs.surfaceCount > 0 || inputs.phraseTokenCount > 0;
}

/**
 * True quando la compile deve invocare la proposta IA lessico/slot (con o senza backend).
 */
export function shouldRunIaCompileSlotMapping(inputs: CatalogCompileIaMappingInputs): boolean {
  return catalogHasCompileMappingInputs(inputs);
}

/**
 * @deprecated Usare {@link shouldRunIaCompileSlotMapping}. Mantenuto per chiamate legacy.
 */
export function shouldRunBackendIaCompileMapping(
  inputs: CatalogCompileIaMappingInputs,
  _backendLinked: boolean
): boolean {
  return shouldRunIaCompileSlotMapping(inputs);
}
