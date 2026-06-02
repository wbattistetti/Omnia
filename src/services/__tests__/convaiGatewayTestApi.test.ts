import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  forwardBackendCallViaConvaiGateway,
  resolveConvaiGatewayFetchUrl,
} from '../convaiGatewayTestApi';

describe('resolveConvaiGatewayFetchUrl', () => {
  const prevDev = import.meta.env.DEV;

  afterEach(() => {
    import.meta.env.DEV = prevDev;
  });

  it('returns relative path for localhost gateway in dev (Vite proxy)', () => {
    import.meta.env.DEV = true;
    expect(
      resolveConvaiGatewayFetchUrl(
        'http://localhost:3100/api/runtime/convai-webhook/proj-1/agent-1/bk-1'
      )
    ).toBe('/api/runtime/convai-webhook/proj-1/agent-1/bk-1');
  });

  it('keeps ngrok absolute URL in dev', () => {
    import.meta.env.DEV = true;
    const ngrok =
      'https://abc.ngrok-free.app/api/runtime/convai-webhook/proj-1/agent-1/bk-1';
    expect(resolveConvaiGatewayFetchUrl(ngrok)).toBe(ngrok);
  });

  it('passes through path-only URLs in dev', () => {
    import.meta.env.DEV = true;
    expect(
      resolveConvaiGatewayFetchUrl('/api/runtime/convai-webhook/proj-1/agent-1/bk-1')
    ).toBe('/api/runtime/convai-webhook/proj-1/agent-1/bk-1');
  });

  it('keeps absolute URL in production build', () => {
    import.meta.env.DEV = false;
    const url = 'http://localhost:3100/api/runtime/convai-webhook/p/a/b';
    expect(resolveConvaiGatewayFetchUrl(url)).toBe(url);
  });
});

describe('forwardBackendCallViaConvaiGateway', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => '{"slots":[]}',
      }))
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('POSTs parsed body to resolved gateway URL', async () => {
    import.meta.env.DEV = true;
    const gatewayUrl =
      'http://localhost:3100/api/runtime/convai-webhook/proj-1/agent-1/bk-1';
    const res = await forwardBackendCallViaConvaiGateway({
      gatewayPublicUrl: gatewayUrl,
      bodyJson: '{"foo":"bar"}',
    });
    expect(res.ok).toBe(true);
    expect(res.status).toBe(200);
    expect(res.bodyText).toBe('{"slots":[]}');
    expect(fetch).toHaveBeenCalledWith(
      '/api/runtime/convai-webhook/proj-1/agent-1/bk-1',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ foo: 'bar' }),
      })
    );
  });

  it('sends empty object when bodyJson is null or {}', async () => {
    import.meta.env.DEV = true;
    await forwardBackendCallViaConvaiGateway({
      gatewayPublicUrl: 'http://127.0.0.1:3100/api/runtime/convai-webhook/p/a/b',
      bodyJson: '{}',
    });
    expect(fetch).toHaveBeenCalledWith(
      '/api/runtime/convai-webhook/p/a/b',
      expect.objectContaining({
        body: JSON.stringify({}),
      })
    );
  });
});
