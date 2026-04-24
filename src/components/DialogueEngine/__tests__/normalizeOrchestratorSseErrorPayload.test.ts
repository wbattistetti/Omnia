import { describe, expect, it } from 'vitest';
import { normalizeOrchestratorSseErrorPayload } from '../orchestratorAdapter';

describe('normalizeOrchestratorSseErrorPayload', () => {
  it('maps PascalCase keys and string httpStatus', () => {
    const n = normalizeOrchestratorSseErrorPayload({
      Error: 'upstream failed',
      HttpStatus: '502',
      Phase: 'startAgent',
      AgentId: 'ag_1',
      BaseUrl: 'http://localhost:5000',
      Timestamp: '2026-01-01T00:00:00Z',
    });
    expect(n.error).toBe('upstream failed');
    expect(n.httpStatus).toBe(502);
    expect(n.phase).toBe('startAgent');
    expect(n.agentId).toBe('ag_1');
    expect(n.baseUrl).toBe('http://localhost:5000');
    expect(n.timestamp).toBe('2026-01-01T00:00:00Z');
  });

  it('preserves camelCase payload', () => {
    const n = normalizeOrchestratorSseErrorPayload({
      error: 'x',
      httpStatus: 400,
      phase: 'startAgent',
      apiServerBody: '{"error":"bad"}',
    });
    expect(n.error).toBe('x');
    expect(n.httpStatus).toBe(400);
    expect(n.apiServerBody).toBe('{"error":"bad"}');
  });
});
