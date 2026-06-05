import { beforeEach, describe, expect, it, vi } from 'vitest';
import { saveDevTunnelPortMapToStorage } from '../devTunnelCompileBridge';
import {
  CONVAI_WEBHOOK_GATEWAY_PORT,
  ensureConvaiDeployTunnelReady,
} from '../ensureConvaiDeployTunnelReady';
import * as ngrokTunnelMapSync from '../ngrokTunnelMapSync';
import { mergeNgrokStatusIntoPortMap, ngrokTunnelsReadyForPorts } from '../ngrokTunnelMapSync';

vi.mock('@services/devTunnelNgrokApi', () => ({
  fetchNgrokTunnelStatus: vi.fn(),
  startNgrokTunnels: vi.fn(),
}));

import { fetchNgrokTunnelStatus, startNgrokTunnels } from '@services/devTunnelNgrokApi';

describe('ngrokTunnelMapSync', () => {
  it('mergeNgrokStatusIntoPortMap extracts running public URLs', () => {
    expect(
      mergeNgrokStatusIntoPortMap({
        '3100': { running: true, publicUrl: 'https://abc.ngrok-free.app/' },
      })
    ).toEqual({ 3100: 'https://abc.ngrok-free.app' });
  });

  it('ngrokTunnelsReadyForPorts requires running + publicUrl', () => {
    expect(
      ngrokTunnelsReadyForPorts([3100], {
        '3100': { running: true, publicUrl: 'https://x.ngrok-free.app' },
      })
    ).toBe(true);
    expect(
      ngrokTunnelsReadyForPorts([3100], {
        '3100': { running: false, publicUrl: 'https://x.ngrok-free.app' },
      })
    ).toBe(false);
  });
});

describe('ensureConvaiDeployTunnelReady', () => {
  beforeEach(() => {
    vi.mocked(fetchNgrokTunnelStatus).mockReset();
    vi.mocked(startNgrokTunnels).mockReset();
    vi.spyOn(ngrokTunnelMapSync, 'loadNgrokAuthtokenFromStorage').mockReturnValue('');
    saveDevTunnelPortMapToStorage({});
  });

  it('returns ok when tunnel already running on gateway port', async () => {
    vi.mocked(fetchNgrokTunnelStatus).mockResolvedValue({
      ok: true,
      running: true,
      tunnels: {
        '3100': { running: true, publicUrl: 'https://live.ngrok-free.app' },
      },
    });

    const out = await ensureConvaiDeployTunnelReady([CONVAI_WEBHOOK_GATEWAY_PORT]);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.started).toBe(false);
      expect(out.publicUrlsByPort[3100]).toBe('https://live.ngrok-free.app');
    }
    expect(startNgrokTunnels).not.toHaveBeenCalled();
    if (out.ok) {
      expect(out.publicUrlsByPort[3100]).toBe('https://live.ngrok-free.app');
    }
  });

  it('starts tunnel when missing and token is configured', async () => {
    vi.spyOn(ngrokTunnelMapSync, 'loadNgrokAuthtokenFromStorage').mockReturnValue('test-token');
    vi.mocked(fetchNgrokTunnelStatus)
      .mockResolvedValueOnce({ ok: true, running: false, tunnels: {} })
      .mockResolvedValueOnce({
        ok: true,
        running: true,
        tunnels: {
          '3100': { running: true, publicUrl: 'https://new.ngrok-free.app' },
        },
      });
    vi.mocked(startNgrokTunnels).mockResolvedValue({
      ok: true,
      tunnels: { '3100': { publicUrl: 'https://new.ngrok-free.app', localPort: 3100 } },
    });

    const out = await ensureConvaiDeployTunnelReady();
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.started).toBe(true);
    expect(startNgrokTunnels).toHaveBeenCalledWith({
      ports: [3100],
      authtoken: 'test-token',
    });
  });

  it('fails when ngrok authtoken is missing', async () => {
    vi.mocked(fetchNgrokTunnelStatus).mockResolvedValue({
      ok: true,
      running: false,
      tunnels: {},
    });

    const out = await ensureConvaiDeployTunnelReady();
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toMatch(/Token ngrok mancante/i);
  });

  it('fails when Express is unreachable', async () => {
    vi.mocked(fetchNgrokTunnelStatus).mockResolvedValue({
      ok: false,
      error: 'Connessione Express fallita',
    });

    const out = await ensureConvaiDeployTunnelReady();
    expect(out.ok).toBe(false);
  });

  it('restarts tunnel when localStorage has stale URL but ngrok is down', async () => {
    saveDevTunnelPortMapToStorage({ 3100: 'https://stale.ngrok-free.app' });
    vi.spyOn(ngrokTunnelMapSync, 'loadNgrokAuthtokenFromStorage').mockReturnValue('tok');

    vi.mocked(fetchNgrokTunnelStatus)
      .mockResolvedValueOnce({ ok: true, running: false, tunnels: {} })
      .mockResolvedValueOnce({
        ok: true,
        running: true,
        tunnels: {
          '3100': { running: true, publicUrl: 'https://fresh.ngrok-free.app' },
        },
      });
    vi.mocked(startNgrokTunnels).mockResolvedValue({
      ok: true,
      tunnels: { '3100': { publicUrl: 'https://fresh.ngrok-free.app', localPort: 3100 } },
    });

    const out = await ensureConvaiDeployTunnelReady();
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.publicUrlsByPort[3100]).toBe('https://fresh.ngrok-free.app');
      expect(out.started).toBe(true);
    }
  });
});
