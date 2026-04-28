/**
 * fetchIaAgentGlobalConfig: 404 = nessuna config salvata (stesso semantica di config null).
 * putIaAgentGlobalConfig: se PUT 404, ritenta con POST.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchIaAgentGlobalConfig, putIaAgentGlobalConfig } from '../iaAgentGlobalConfigApi';

describe('fetchIaAgentGlobalConfig', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('tratta HTTP 404 come config assente (null)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => 'Not Found',
      })
    );
    const r = await fetchIaAgentGlobalConfig('proj_x');
    expect(r).toEqual({ ok: true, configJson: null });
  });

  it('propaga altri errori HTTP', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'boom',
      })
    );
    const r = await fetchIaAgentGlobalConfig('proj_x');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('HTTP 500');
  });
});

describe('putIaAgentGlobalConfig', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('su PUT 404 ritenta POST', async () => {
    const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        return Promise.resolve({
          ok: false,
          status: 404,
          text: async () => 'Cannot PUT',
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        text: async () => '{"ok":true}',
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    const r = await putIaAgentGlobalConfig('proj_x', '{}');
    expect(r).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
