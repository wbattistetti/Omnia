import { parseFlowBackendCallInvocation } from '../flowBackendCallDiagnostic';

describe('parseFlowBackendCallInvocation', () => {
  it('parses camelCase payload', () => {
    const p = parseFlowBackendCallInvocation({
      taskId: 'abc',
      displayName: 'My API',
      endpoint: 'http://localhost:3100/x',
      method: 'GET',
      outcome: 'success',
      matchedRowId: 'r1',
      inputParameters: [{ name: 'a', value: 1 }],
      outputParameters: [{ name: 'b', value: 2 }],
      listPreviewLimit: 8,
    });
    expect(p).not.toBeNull();
    expect(p!.displayName).toBe('My API');
    expect(p!.inputParameters).toEqual([{ name: 'a', value: 1 }]);
    expect(p!.listPreviewLimit).toBe(8);
  });

  it('accepts PascalCase keys', () => {
    const p = parseFlowBackendCallInvocation({
      TaskId: 't1',
      DisplayName: 'Pascal',
      Outcome: 'no_match',
      InputParameters: [{ Name: 'n', Value: 'v' }],
    });
    expect(p).not.toBeNull();
    expect(p!.taskId).toBe('t1');
    expect(p!.outcome).toBe('no_match');
    expect(p!.inputParameters).toEqual([{ name: 'n', value: 'v' }]);
  });

  it('keeps HTTP-specific outcomes', () => {
    const p = parseFlowBackendCallInvocation({
      taskId: 't-http',
      outcome: 'http_error',
    });
    expect(p).not.toBeNull();
    expect(p!.outcome).toBe('http_error');
  });

  it('returns null without task id', () => {
    expect(parseFlowBackendCallInvocation({})).toBeNull();
  });

  it('parses catalogEvent / catalogHint / catalogFields for osservabilità v1', () => {
    const p = parseFlowBackendCallInvocation({
      taskId: 't-cat',
      outcome: 'http_error',
      CatalogEvent: 'validation_rejected',
      CatalogHint: 'Controlla SEND.',
      CatalogFields: { fieldPath: 'queryConstraints', endpoint: '/bookfromagenda' },
    });
    expect(p!.catalogEvent).toBe('validation_rejected');
    expect(p!.catalogHint).toBe('Controlla SEND.');
    expect(p!.catalogFields?.fieldPath).toBe('queryConstraints');
  });

  it('parses httpStatus and extracts diagnostic from JSON responsePreview', () => {
    const body = {
      ok: false,
      error: 'x',
      diagnostic: { schemaVersion: 1, timeline: [{ id: 'a', ok: true }] },
    };
    const p = parseFlowBackendCallInvocation({
      taskId: 't1',
      outcome: 'http_error',
      httpStatus: 400,
      responsePreview: JSON.stringify(body),
    });
    expect(p!.httpStatus).toBe(400);
    expect(p!.diagnostic?.schemaVersion).toBe(1);
    expect(Array.isArray(p!.diagnostic?.timeline)).toBe(true);
  });
});
