import { describe, expect, it, vi } from 'vitest';
import { resolveOmniaApiBase } from '../resolveOmniaApiBase';

describe('resolveOmniaApiBase', () => {
  it('returns empty string when VITE_BACKEND_URL is unset (same-origin API)', () => {
    vi.stubEnv('VITE_BACKEND_URL', '');
    expect(resolveOmniaApiBase()).toBe('');
  });

  it('strips trailing slash from VITE_BACKEND_URL', () => {
    vi.stubEnv('VITE_BACKEND_URL', 'https://api.example.com/');
    expect(resolveOmniaApiBase()).toBe('https://api.example.com');
  });
});
