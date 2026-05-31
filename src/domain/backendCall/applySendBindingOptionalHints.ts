/**
 * Allinea `sendBindingOptional` sulle righe mapping SEND da meta Read API (senza nuovo import OpenAPI).
 */

import type { BackendCallSpecMeta } from '../backendCatalog/catalogTypes';
import type { MappingEntry } from '../../components/FlowMappingPanel/mappingTypes';
import { buildSendBindingRowFieldsForApiParam } from './sendBindingRowFields';

/** Applica hint opzionalità mancanti sulle entry SEND (UI + Test API). */
export function applySendBindingOptionalHintsToMappingEntries(
  entries: MappingEntry[],
  meta?: BackendCallSpecMeta | null
): MappingEntry[] {
  if (!meta) return entries;

  const apiNamesFromRows = entries.map((e) => e.apiField?.trim()).filter(Boolean) as string[];
  const bodyProps =
    meta.openapiRequestBodyPropertyNames && meta.openapiRequestBodyPropertyNames.length > 0
      ? meta.openapiRequestBodyPropertyNames
      : apiNamesFromRows;
  const bodyRequired = meta?.openapiRequestBodyRequiredPropertyNames ?? [];
  const rules =
    meta?.openapiSendBinding === null || meta?.openapiSendBinding === undefined
      ? undefined
      : meta.openapiSendBinding;

  const ctx = {
    requestBodyPropertyNames: bodyProps,
    requestBodyRequiredPropertyNames: bodyRequired,
  };

  return entries.map((e) => {
    const api = e.apiField?.trim();
    if (!api) return e;
    const bind = buildSendBindingRowFieldsForApiParam(api, rules, ctx);
    const nextOptional = Boolean(bind.sendBindingOptional);
    const nextDesign = Boolean(bind.sendBindingDesignTimeRequired);
    const groupId = bind.sendConstraintGroupId;
    const groupLabel = bind.sendConstraintGroupLabel;
    if (
      e.sendBindingOptional === nextOptional &&
      e.sendBindingDesignTimeRequired === nextDesign &&
      e.sendConstraintGroupId === groupId &&
      e.sendConstraintGroupLabel === groupLabel
    ) {
      return e;
    }
    return {
      ...e,
      sendBindingOptional: nextOptional,
      ...(nextDesign ? { sendBindingDesignTimeRequired: true } : {}),
      ...(groupId
        ? {
            sendConstraintGroupId: groupId,
            ...(groupLabel ? { sendConstraintGroupLabel: groupLabel } : {}),
          }
        : {}),
    };
  });
}
