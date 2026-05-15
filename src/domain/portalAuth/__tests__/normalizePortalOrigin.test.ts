import { describe, expect, it } from 'vitest';
import { normalizePortalOrigin } from '../normalizePortalOrigin';

describe('normalizePortalOrigin', () => {
  it('strips path and query', () => {
    expect(normalizePortalOrigin('https://beehive.example.com/api/v3/api-docs')).toBe(
      'https://beehive.example.com'
    );
  });

  it('keeps port', () => {
    expect(normalizePortalOrigin('http://localhost:8080/swagger')).toBe('http://localhost:8080');
  });
});
