import { describe, expect, it } from 'vitest';
import { TaskType, type Task } from '@types/taskTypes';
import { readBackendCallEndpoint, resolveBackendCallHttpMethod } from '../backendCallEndpoint';

function backend(overrides: Partial<Task> & { id: string }): Task {
  return {
    type: TaskType.BackendCall,
    label: 'api',
    endpoint: { url: 'https://x/api/runtime/bookfromagenda', method: 'GET', headers: {} },
    inputs: [],
    outputs: [],
    ...overrides,
  } as Task;
}

describe('resolveBackendCallHttpMethod', () => {
  it('forza POST su bookfromagenda anche se endpoint.method è GET', () => {
    const t = backend({ id: 'b1' });
    expect(resolveBackendCallHttpMethod(t, 'https://x/api/runtime/bookfromagenda')).toBe('POST');
  });

  it('forza POST su next-window anche se endpoint.method è GET', () => {
    const t = backend({
      id: 'nw1',
      endpoint: {
        url: 'https://x.supabase.co/functions/v1/agenda-solver/next-window',
        method: 'GET',
        headers: {},
      },
    });
    expect(resolveBackendCallHttpMethod(t, t.endpoint!.url!)).toBe('POST');
  });

  it('usa openApiLockedHttpMethod quando import ok e URL coincide', () => {
    const t = backend({
      id: 'b2',
      endpoint: { url: 'https://x/slots', method: 'GET', headers: {} },
      backendCallSpecMeta: {
        schemaVersion: 1,
        lastImportedAt: '2026-01-01T00:00:00.000Z',
        contentHash: 'h',
        importState: 'ok',
        structuralFingerprint: 'fp',
        openApiMethodLocked: true,
        openApiMethodLockUrlSnapshot: 'https://x/slots',
        openApiLockedHttpMethod: 'POST',
      },
    } as Partial<Task> as Task);
    expect(resolveBackendCallHttpMethod(t, 'https://x/slots')).toBe('POST');
  });

  it('readBackendCallEndpoint espone POST risolto', () => {
    const t = backend({ id: 'b3' });
    expect(readBackendCallEndpoint(t).method).toBe('POST');
  });
});
