/**
 * Tooltip unificato per righe firma backend: tipo e descrizione OpenAPI fuori dalla lista.
 */

import type { MappingEntry } from './mappingTypes';

/** Testo tooltip (tipo, descrizione, note schema-only) per hover su nome parametro. */
export function buildMappingParamTooltip(entry: MappingEntry | undefined): string | undefined {
  if (!entry) return undefined;
  const lines: string[] = [];
  const type = entry.openapiFormatLabel?.trim();
  if (type) lines.push(`Tipo: ${type}`);
  const desc = entry.fieldDescription?.trim() || entry.openapiDescriptionHint?.trim();
  if (desc) lines.push(desc);
  const valueHint = entry.openapiValueHint?.trim();
  if (valueHint && valueHint !== desc) lines.push(valueHint);
  if (entry.schemaOutlineOnly) {
    lines.push('Proprietà da schema OpenAPI — non mappata sul task');
  }
  return lines.length ? lines.join('\n\n') : undefined;
}
