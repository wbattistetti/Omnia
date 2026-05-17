/**
 * Builds flat Backend Call SEND/RECEIVE rows from a resolved OpenAPI operation (preview only).
 */

import type { OpenApiOperationFields } from '@services/openApiBackendCallSpec';
import type {
  BackendCallInputRow,
  BackendCallOutputRow,
} from '@components/FlowMappingPanel/backendCallMappingAdapter';
import type { OpenApiSendBindingRules } from '@domain/backendCatalog/catalogTypes';

function toTreeInternalName(apiName: string): string {
  const raw = String(apiName || '').trim();
  if (!raw) return 'field';
  const safe = raw
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/^_+|_+$/g, '');
  return safe || 'field';
}

function nextUniqueInternalName(base: string, used: Set<string>): string {
  let n = base;
  let k = 0;
  while (used.has(n)) {
    k += 1;
    n = `${base}_${k}`;
  }
  used.add(n);
  return n;
}

function sendBindingRowFields(
  apiName: string,
  rules: OpenApiSendBindingRules | undefined
): Pick<
  BackendCallInputRow,
  | 'sendBindingOptional'
  | 'sendBindingDesignTimeRequired'
  | 'sendConstraintGroupId'
  | 'sendConstraintGroupLabel'
> {
  if (!rules) return {};
  if (rules.optionalApiParams.includes(apiName)) {
    return { sendBindingOptional: true };
  }
  const design =
    rules.designTimeRequiredApiParams?.includes(apiName) === true
      ? { sendBindingDesignTimeRequired: true as const }
      : {};
  for (const set of rules.requireOneOfSets ?? []) {
    for (const alt of set.alternatives) {
      if (alt.allApiParams.includes(apiName)) {
        return {
          ...design,
          sendConstraintGroupId: set.id,
          ...(set.label?.trim() ? { sendConstraintGroupLabel: set.label.trim() } : {}),
        };
      }
    }
  }
  return Object.keys(design).length > 0 ? design : {};
}

/** SEND + RECEIVE rows for mapping UI (no task persistence). */
export function buildBackendCallRowsFromOpenApiFields(fields: OpenApiOperationFields): {
  inputs: BackendCallInputRow[];
  outputs: BackendCallOutputRow[];
  inputUiKindByWireKey: Record<string, string>;
  inputEnumByWireKey: Record<string, string[]>;
} {
  const inputNames = [
    ...new Set([...fields.requestParamNames, ...fields.requestBodyPropertyNames]),
  ].filter(Boolean);
  const outputNames = fields.responsePropertyNames.filter(Boolean);

  const usedIn = new Set<string>();
  const inputs: BackendCallInputRow[] = [];
  for (const apiName of inputNames) {
    const internalName = nextUniqueInternalName(toTreeInternalName(apiName), usedIn);
    const bind = sendBindingRowFields(apiName, fields.sendBindingRules);
    const phase = fields.bindingPhaseByApiName?.[apiName];
    inputs.push({
      internalName,
      apiParam: apiName,
      variable: '',
      ...bind,
      ...(phase ? { sendBindingBindingPhase: phase } : {}),
      ...(fields.inputDescriptionsByApiName[apiName]?.trim()
        ? { fieldDescription: fields.inputDescriptionsByApiName[apiName].trim() }
        : {}),
    });
  }

  const usedOut = new Set<string>();
  const outputs: BackendCallOutputRow[] = [];
  for (const apiName of outputNames) {
    const internalName = nextUniqueInternalName(toTreeInternalName(apiName), usedOut);
    outputs.push({
      internalName,
      apiField: apiName,
      variable: '',
      ...(fields.outputDescriptionsByApiName[apiName]?.trim()
        ? { fieldDescription: fields.outputDescriptionsByApiName[apiName].trim() }
        : {}),
    });
  }

  const inputUiKindByWireKey: Record<string, string> = {};
  const inputEnumByWireKey: Record<string, string[]> = {};
  for (const row of inputs) {
    const wire = row.internalName.trim();
    const api = row.apiParam?.trim();
    if (!wire || !api) continue;
    const kind = fields.inputUiKindByApiName[api];
    if (kind) inputUiKindByWireKey[wire] = kind;
    const en = fields.inputEnumByApiName[api];
    if (en?.length) inputEnumByWireKey[wire] = en;
  }

  return { inputs, outputs, inputUiKindByWireKey, inputEnumByWireKey };
}
