import { describe, expect, it } from 'vitest';
import {
  formatDeleteAgentHttpError,
  formatListAgentsHttpError,
} from '../convaiProvisionHttpError';

function fakeRes(status: number, statusText: string): Response {
  return { status, statusText } as Response;
}

describe('convaiProvisionHttpError', () => {
  describe('formatListAgentsHttpError', () => {
    it('formats non-JSON body with HTTP line and URL', () => {
      const res = fakeRes(502, 'Bad Gateway');
      const msg = formatListAgentsHttpError(res, 'https://api.example/proxy', 'upstream timeout');
      expect(msg).toContain('listAgents:');
      expect(msg).toContain('502');
      expect(msg).toContain('Bad Gateway');
      expect(msg).toContain('upstream timeout');
      expect(msg).toContain('[GET https://api.example/proxy]');
    });

    it('formats JSON body with error and detail', () => {
      const res = fakeRes(400, 'Bad Request');
      const body = JSON.stringify({
        error: 'invalid_request',
        details: 'missing field',
        phase: 'list',
        statusCode: 400,
      });
      const msg = formatListAgentsHttpError(res, 'https://x/y', body);
      expect(msg).toContain('listAgents: invalid_request');
      expect(msg).toContain('(list)');
      expect(msg).toContain('upstream HTTP 400');
      expect(msg).toContain('— missing field');
    });
  });

  describe('formatDeleteAgentHttpError', () => {
    it('formats non-JSON body', () => {
      const res = fakeRes(404, 'Not Found');
      const msg = formatDeleteAgentHttpError(res, 'ag_123', 'gone');
      expect(msg).toContain('deleteAgent:');
      expect(msg).toContain('404');
      expect(msg).toContain('gone');
      expect(msg).toContain('[agent ag_123]');
    });

    it('formats JSON body with error only', () => {
      const res = fakeRes(403, 'Forbidden');
      const body = JSON.stringify({ error: 'forbidden' });
      const msg = formatDeleteAgentHttpError(res, 'ag_z', body);
      expect(msg).toBe('deleteAgent: forbidden');
    });

    it('includes detail when present', () => {
      const res = fakeRes(400, 'Bad Request');
      const body = JSON.stringify({ error: 'bad', detail: 'reason' });
      expect(formatDeleteAgentHttpError(res, 'id', body)).toBe('deleteAgent: bad — reason');
    });
  });
});
