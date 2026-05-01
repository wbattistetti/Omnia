import { describe, it, expect } from 'vitest';
import { canonicalKey, normalizePathname, structuralFingerprint } from '../canonicalKey';

describe('canonicalKey', () => {
  it('same path with trailing slash merges', () => {
    const a = canonicalKey({ method: 'GET', endpointUrl: 'http://localhost:3110/slots/' });
    const b = canonicalKey({ method: 'GET', endpointUrl: 'http://localhost:3110/slots' });
    expect(a).toBe(b);
  });

  it('GET vs POST differ', () => {
    const g = canonicalKey({ method: 'GET', endpointUrl: 'http://x/a' });
    const p = canonicalKey({ method: 'POST', endpointUrl: 'http://x/a' });
    expect(g).not.toBe(p);
  });

  it('operationId disambiguates', () => {
    const a = canonicalKey({ method: 'GET', endpointUrl: 'http://x/a', operationId: 'list' });
    const b = canonicalKey({ method: 'GET', endpointUrl: 'http://x/a', operationId: 'get' });
    expect(a).not.toBe(b);
  });

  it('query string excluded from path normalization in key', () => {
    const a = canonicalKey({ method: 'GET', endpointUrl: 'http://localhost/slots?N=1' });
    const b = canonicalKey({ method: 'GET', endpointUrl: 'http://localhost/slots?N=2' });
    expect(a).toBe(b);
  });
});

describe('normalizePathname', () => {
  it('strips trailing slash', () => {
    expect(normalizePathname('/api/v1/')).toBe('/api/v1');
  });
});

describe('structuralFingerprint', () => {
  it('stable for same endpoint', () => {
    const a = structuralFingerprint('GET', 'http://127.0.0.1:3110/slots');
    const b = structuralFingerprint('GET', 'http://127.0.0.1:3110/slots');
    expect(a).toBe(b);
  });
});
