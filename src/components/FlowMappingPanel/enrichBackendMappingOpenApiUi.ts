/**
 * Arricchisce le righe mapping backend con flag drift (descrizione locale vs ultimo OpenAPI) per sola UI.
 */

import type { OpenApiParamPathHint } from '../../services/openApiParamPathHints';
import {
  buildOpenApiValueFieldTooltip,
  lookupOpenApiParamPathHint,
  openApiParamFormatLabel,
} from '../../services/openApiParamPathHints';
import type { MappingEntry } from './mappingTypes';
import { descriptionsDifferFromOpenApi } from '../../services/openApiBackendCallSpec';

export function enrichBackendMappingEntriesOpenApi(
  entries: MappingEntry[],
  column: 'send' | 'receive',
  snapshots: { inputs: Record<string, string>; outputs: Record<string, string> } | null | undefined,
  hintsByPath?: Record<string, OpenApiParamPathHint> | null
): MappingEntry[] {
  const map = column === 'send' ? snapshots?.inputs : snapshots?.outputs;
  return entries.map((e) => {
    const api = e.apiField?.trim();
    const wireKey = e.wireKey?.trim() ?? '';
    const pathHint = lookupOpenApiParamPathHint(hintsByPath ?? undefined, wireKey, api);
    const openapiText =
      pathHint?.description?.trim() ||
      (api && map ? map[api]?.trim() : undefined) ||
      undefined;
    const drift = descriptionsDifferFromOpenApi(e.fieldDescription, openapiText);
    const formatLabel = openApiParamFormatLabel(pathHint);
    const openapiValueHint = buildOpenApiValueFieldTooltip({
      hint: pathHint,
      enumValues: pathHint?.enum,
      isEmpty: false,
    });
    return {
      ...e,
      openapiDescriptionDrift: drift,
      openapiDescriptionHint: openapiText,
      openapiValueHint,
      openapiFormatLabel: formatLabel,
    };
  });
}
