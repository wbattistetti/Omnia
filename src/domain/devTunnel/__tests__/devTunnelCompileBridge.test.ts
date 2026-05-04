import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  collectDevTunnelCompileErrors,
  DEV_TUNNEL_COMPILE_FLAG_KEY,
  getCompileUseDevTunnel,
  rewriteCompilePayloadWithDevTunnel,
  saveDevTunnelPortMapToStorage,
} from '../devTunnelCompileBridge';

beforeEach(() => {
  const map = new Map<string, string>();
  vi.stubGlobal(
    'localStorage',
    {
      getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
      setItem: (k: string, v: string) => {
        map.set(k, v);
      },
      removeItem: (k: string) => {
        map.delete(k);
      },
      clear: () => map.clear(),
      length: 0,
      key: () => null,
    } as Storage
  );
});

describe('devTunnelCompileBridge', () => {
  it('compile gate, collect errors, rewrite URLs (sequential localStorage)', () => {
    localStorage.setItem(DEV_TUNNEL_COMPILE_FLAG_KEY, '1');
    expect(getCompileUseDevTunnel()).toBe(true);
    localStorage.clear();
    localStorage.setItem(DEV_TUNNEL_COMPILE_FLAG_KEY, '0');
    expect(getCompileUseDevTunnel()).toBe(false);
    expect(
      collectDevTunnelCompileErrors([{ id: 'a', endpoint: 'http://127.0.0.1:3110/x' }])
    ).toEqual([]);

    localStorage.setItem(DEV_TUNNEL_COMPILE_FLAG_KEY, '1');
    expect(getCompileUseDevTunnel()).toBe(true);
    const errs = collectDevTunnelCompileErrors([{ id: 't1', endpoint: 'http://127.0.0.1:3110/slots' }]);
    expect(errs).toHaveLength(1);
    expect(String((errs[0] as { code?: string }).code)).toBe('DevTunnelLocalhostPortNotExposed');

    saveDevTunnelPortMapToStorage({
      3110: 'https://abc.ngrok-free.app',
      3100: 'https://pub.example',
    });
    expect(
      collectDevTunnelCompileErrors([{ id: 't1', endpoint: 'http://localhost:3110/slots' }])
    ).toHaveLength(0);

    const doc = { url: 'http://127.0.0.1:3100/api/ping', nested: { x: 'http://localhost:3100/a' } };
    const out = rewriteCompilePayloadWithDevTunnel(doc);
    expect(out.url).toBe('https://pub.example/api/ping');
    expect((out as { nested: { x: string } }).nested.x).toBe('https://pub.example/a');
  });

  it('rewrite IPv6 localhost [::1] when tunnel map present', () => {
    saveDevTunnelPortMapToStorage({ 7777: 'https://xyz.ngrok-free.app' });
    const doc = { u: 'http://[::1]:7777/ping' };
    const out = rewriteCompilePayloadWithDevTunnel(doc);
    expect((out as { u: string }).u).toBe('https://xyz.ngrok-free.app/ping');
  });
});
