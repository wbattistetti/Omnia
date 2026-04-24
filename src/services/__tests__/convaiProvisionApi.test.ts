import { describe, expect, it, vi, afterEach } from 'vitest';
import { createConvaiAgentViaOmniaServer } from '../convaiProvisionApi';

describe('convaiProvisionApi', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('createConvaiAgentViaOmniaServer returns agentId on 200', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ agentId: 'ag_12345' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const out = await createConvaiAgentViaOmniaServer({ name: 'test' });

    expect(out.agentId).toBe('ag_12345');
    expect(fetchMock).toHaveBeenCalledWith(
      '/elevenlabs/createAgent',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'test' }),
      })
    );
  });

  it('sends conversation_config when provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ agentId: 'ag_cc' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await createConvaiAgentViaOmniaServer({
      name: 'x',
      conversation_config: { agent: { language: 'fr' } },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/elevenlabs/createAgent',
      expect.objectContaining({
        body: JSON.stringify({
          name: 'x',
          conversation_config: { agent: { language: 'fr' } },
        }),
      })
    );
  });

  it('throws on non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        text: async () => JSON.stringify({ error: 'bad', details: 'x' }),
      })
    );

    await expect(createConvaiAgentViaOmniaServer()).rejects.toThrow(/bad/);
  });

  it('includes ElevenLabs API base in error when server returns it', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: async () =>
          JSON.stringify({
            error: 'ElevenLabs agents/create failed.',
            elevenLabsApiBase: 'https://api.eu.residency.elevenlabs.io',
            details: '{}',
          }),
      })
    );

    await expect(createConvaiAgentViaOmniaServer()).rejects.toThrow(
      /ElevenLabs API base: https:\/\/api\.eu\.residency\.elevenlabs\.io/
    );
  });
});
