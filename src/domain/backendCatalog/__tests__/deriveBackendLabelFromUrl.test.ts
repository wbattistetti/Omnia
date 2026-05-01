import { describe, expect, it } from 'vitest';
import { deriveBackendLabelFromUrl } from '../deriveBackendLabelFromUrl';

describe('deriveBackendLabelFromUrl', () => {
  it('uses last path segment', () => {
    expect(deriveBackendLabelFromUrl('http://localhost:3110/slots')).toBe('slots');
    expect(deriveBackendLabelFromUrl('https://api.example.com/v1/users')).toBe('users');
  });

  it('trims trailing slash', () => {
    expect(deriveBackendLabelFromUrl('https://x.com/foo/bar/')).toBe('bar');
  });

  it('decodes segment', () => {
    expect(deriveBackendLabelFromUrl('https://x.com/a/hello%20world')).toBe('hello world');
  });

  it('falls back to hostname when path is empty', () => {
    expect(deriveBackendLabelFromUrl('https://api.example.com/')).toBe('api.example.com');
    expect(deriveBackendLabelFromUrl('http://localhost:8080')).toBe('localhost');
  });

  it('handles scheme-less host/path', () => {
    expect(deriveBackendLabelFromUrl('api.foo.com/v2/items')).toBe('items');
  });

  it('returns empty for blank', () => {
    expect(deriveBackendLabelFromUrl('')).toBe('');
    expect(deriveBackendLabelFromUrl('   ')).toBe('');
  });
});
