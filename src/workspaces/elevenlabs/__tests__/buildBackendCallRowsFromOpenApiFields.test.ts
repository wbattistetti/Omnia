import { describe, expect, it } from 'vitest';
import { buildBackendCallRowsFromOpenApiFields } from '../buildBackendCallRowsFromOpenApiFields';
import type { OpenApiOperationFields } from '@services/openApiBackendCallSpec';

describe('buildBackendCallRowsFromOpenApiFields', () => {
  it('maps request params and response properties to SEND/RECEIVE rows', () => {
    const fields: OpenApiOperationFields = {
      requestParamNames: ['q'],
      requestBodyPropertyNames: ['nome', 'data'],
      responsePropertyNames: ['ok', 'id'],
      inputDescriptionsByApiName: { nome: 'Nome cliente' },
      outputDescriptionsByApiName: { ok: 'Esito' },
      inputUiKindByApiName: { data: 'date' },
      inputEnumByApiName: {},
    };
    const { inputs, outputs, inputUiKindByWireKey } = buildBackendCallRowsFromOpenApiFields(fields);
    expect(inputs.map((r) => r.apiParam)).toEqual(['q', 'nome', 'data']);
    expect(inputs.find((r) => r.apiParam === 'nome')?.fieldDescription).toBe('Nome cliente');
    expect(outputs.map((r) => r.apiField)).toEqual(['ok', 'id']);
    const dataRow = inputs.find((r) => r.apiParam === 'data');
    expect(dataRow?.internalName).toBeTruthy();
    expect(inputUiKindByWireKey[dataRow!.internalName]).toBe('date');
  });

  it('deduplicates colliding internal names', () => {
    const fields: OpenApiOperationFields = {
      requestParamNames: [],
      requestBodyPropertyNames: ['a.b', 'a_b'],
      responsePropertyNames: [],
      inputDescriptionsByApiName: {},
      outputDescriptionsByApiName: {},
      inputUiKindByApiName: {},
      inputEnumByApiName: {},
    };
    const { inputs } = buildBackendCallRowsFromOpenApiFields(fields);
    const names = inputs.map((r) => r.internalName);
    expect(new Set(names).size).toBe(names.length);
  });
});
