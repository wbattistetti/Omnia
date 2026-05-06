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
});
