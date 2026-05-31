/**
 * Campi SEND `sendBindingOptional` / design-time da `x-omnia.sendBinding` o da `required` JSON Schema body.
 */

import type { OpenApiSendBindingRules } from '../backendCatalog/catalogTypes';

export type SendBindingRowFields = {
  sendBindingOptional?: boolean;
  sendBindingDesignTimeRequired?: boolean;
  sendConstraintGroupId?: string;
  sendConstraintGroupLabel?: string;
};

export type SendBindingRowFieldsContext = {
  /** Proprietà top-level del body (OpenAPI). */
  requestBodyPropertyNames?: readonly string[];
  /** Nomi in `schema.required` del body; array vuoto = nessun campo obbligatorio nel body. */
  requestBodyRequiredPropertyNames?: readonly string[];
};

/** Opzionale se proprietà body e assente da `schema.required` (anche con `sendBinding` parziale). */
function applySchemaBodyOptional(
  apiName: string,
  fields: SendBindingRowFields,
  ctx?: SendBindingRowFieldsContext
): SendBindingRowFields {
  if (fields.sendBindingOptional || fields.sendBindingDesignTimeRequired) return fields;
  if (fields.sendConstraintGroupId) return fields;

  const bodyProps = ctx?.requestBodyPropertyNames ?? [];
  if (!bodyProps.includes(apiName)) return fields;

  const schemaRequired = new Set(ctx?.requestBodyRequiredPropertyNames ?? []);
  if (!schemaRequired.has(apiName)) {
    return { ...fields, sendBindingOptional: true };
  }
  return fields;
}

/** Deriva opzionalità riga SEND per nome parametro API. */
export function buildSendBindingRowFieldsForApiParam(
  apiName: string,
  rules: OpenApiSendBindingRules | undefined,
  ctx?: SendBindingRowFieldsContext
): SendBindingRowFields {
  let fields: SendBindingRowFields = {};

  if (rules) {
    if (rules.optionalApiParams.includes(apiName)) {
      fields = { sendBindingOptional: true };
    } else {
      const design =
        rules.designTimeRequiredApiParams?.includes(apiName) === true
          ? { sendBindingDesignTimeRequired: true as const }
          : {};
      for (const set of rules.requireOneOfSets ?? []) {
        for (const alt of set.alternatives) {
          if (alt.allApiParams.includes(apiName)) {
            fields = {
              ...design,
              sendConstraintGroupId: set.id,
              ...(set.label?.trim() ? { sendConstraintGroupLabel: set.label.trim() } : {}),
            };
            break;
          }
        }
      }
      if (Object.keys(fields).length === 0) {
        fields = Object.keys(design).length > 0 ? design : {};
      }
    }
    return applySchemaBodyOptional(apiName, fields, ctx);
  }

  const bodyProps = ctx?.requestBodyPropertyNames ?? [];
  if (!bodyProps.includes(apiName)) return {};

  fields = {};
  return applySchemaBodyOptional(apiName, fields, ctx);
}
