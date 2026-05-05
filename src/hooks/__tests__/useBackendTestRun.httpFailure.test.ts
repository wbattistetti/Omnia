import { describe, expect, it } from 'vitest';
import { formatBackendHttpFailure } from '../useBackendTestRun';
import type { BackendCallProxyResponse } from '../../services/backendCallTestProxyApi';

function proxy(partial: Partial<BackendCallProxyResponse>): BackendCallProxyResponse {
  return {
    ok: false,
    status: 400,
    statusText: 'Bad Request',
    bodyText: '{}',
    ...partial,
  };
}

describe('formatBackendHttpFailure', () => {
  it('prefers message/detail from JSON object', () => {
    expect(formatBackendHttpFailure(proxy({ status: 400 }), { message: 'campo foo mancante' })).toBe(
      'campo foo mancante'
    );
    expect(formatBackendHttpFailure(proxy({ status: 422 }), { detail: 'invalid payload' })).toBe('invalid payload');
  });

  it('falls back to generic labels by status', () => {
    expect(formatBackendHttpFailure(proxy({ status: 404 }), {})).toBe('Errore 404');
    expect(formatBackendHttpFailure(proxy({ status: 400 }), {})).toBe('Errore di validazione (HTTP 400)');
    expect(formatBackendHttpFailure(proxy({ status: 422 }), {})).toBe('Errore di validazione (HTTP 422)');
    expect(formatBackendHttpFailure(proxy({ status: 503 }), {})).toBe('Errore HTTP 503');
  });

  it('uses string JSON body when present', () => {
    expect(formatBackendHttpFailure(proxy({ status: 500 }), 'upstream down')).toBe('upstream down');
  });
});
