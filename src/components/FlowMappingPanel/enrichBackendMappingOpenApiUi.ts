/**
 * Arricchisce le righe mapping backend con flag drift (descrizione locale vs ultimo OpenAPI) per sola UI.
 */

import type { MappingEntry } from './mappingTypes';
import { descriptionsDifferFromOpenApi } from '../../services/openApiBackendCallSpec';

export function enrichBackendMappingEntriesOpenApi(
  entries: MappingEntry[],
  column: 'send' | 'receive',
  snapshots: { inputs: Record<string, string>; outputs: Record<string, string> } | null | undefined
): MappingEntry[] {
  const map = column === 'send' ? snapshots?.inputs : snapshots?.outputs;
  return entries.map((e) => {
    const api = e.apiField?.trim();
    const openapiText = api && map ? map[api] : undefined;
    const drift = descriptionsDifferFromOpenApi(e.fieldDescription, openapiText);
    return {
      ...e,
      openapiDescriptionDrift: drift,
      openapiDescriptionHint: openapiText,
    };
  });
}
