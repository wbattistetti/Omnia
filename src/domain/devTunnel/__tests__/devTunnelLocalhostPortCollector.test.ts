import { describe, it, expect } from 'vitest';
import { collectProjectLocalhostPortsForTunnel } from '../devTunnelLocalhostPortCollector';

describe('devTunnelLocalhostPortCollector', () => {
  it('dedupe same port across localhost spellings and merge tasks + IA', () => {
    const ports = collectProjectLocalhostPortsForTunnel({
      tasks: [
        { id: 'a', endpoint: 'http://127.0.0.1:3110/api' },
        { id: 'b', text: 'hook http://localhost:3110/x' },
      ],
      iaConfig: {
        elevenLabsBackendBaseUrl: 'http://[::1]:9999/v1',
      },
    });
    expect(ports).toEqual([3110, 9999]);
  });

  it('returns empty when no localhost URLs', () => {
    expect(
      collectProjectLocalhostPortsForTunnel({
        tasks: [{ id: 'x', endpoint: 'https://api.example.com' }],
      })
    ).toEqual([]);
  });
});
