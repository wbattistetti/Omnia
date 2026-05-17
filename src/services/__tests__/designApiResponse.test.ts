import { describe, expect, it } from 'vitest';
import { parseDesignApiJsonResponse } from '../designApiResponse';

describe('parseDesignApiJsonResponse', () => {
  it('parses valid JSON', async () => {
    const res = new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
    await expect(parseDesignApiJsonResponse<{ success: boolean }>(res)).resolves.toEqual({
      success: true,
    });
  });

  it('throws a clear error on empty body', async () => {
    const res = new Response('', { status: 502 });
    await expect(parseDesignApiJsonResponse(res)).rejects.toThrow(/Risposta vuota/);
    await expect(parseDesignApiJsonResponse(res)).rejects.toThrow(/3100/);
  });

  it('throws a clear error on non-JSON body', async () => {
    const res = new Response('<html>Bad Gateway</html>', { status: 502 });
    await expect(parseDesignApiJsonResponse(res)).rejects.toThrow(/non JSON/);
  });
});
