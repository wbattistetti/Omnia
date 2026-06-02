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
 * True solo quando serve la proposta IA con contesto OpenAPI backend.
 * Senza backend collegati la compile prosegue con lessico + `compileAllUseCases` (es. agente solo KB).
 */
export function shouldRunBackendIaCompileMapping(
  inputs: CatalogCompileIaMappingInputs,
  backendLinked: boolean
): boolean {
  return catalogHasCompileMappingInputs(inputs) && backendLinked;
}
