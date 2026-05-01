import { describe, it, expect } from 'vitest';
import { evaluateSpecStale, staleReasonForBinding } from '../stalePolicy';
import { SpecStaleReason } from '../catalogTypes';
import { structuralFingerprint } from '../canonicalKey';

describe('evaluateSpecStale', () => {
  it('NO_CONTRACT when import none', () => {
    expect(
      evaluateSpecStale({
        method: 'GET',
        endpointUrl: 'http://x/a',
        importState: 'none',
        fingerprintAtLastOkImport: null,
      })
    ).toBe(SpecStaleReason.NO_CONTRACT);
  });

  it('IMPORT_ERROR', () => {
    expect(
      evaluateSpecStale({
        method: 'GET',
        endpointUrl: 'http://x/a',
        importState: 'error',
        fingerprintAtLastOkImport: null,
      })
    ).toBe(SpecStaleReason.IMPORT_ERROR);
  });

  it('STRUCTURAL_DRIFT when fingerprint differs', () => {
    const fpOld = structuralFingerprint('GET', 'http://x/old');
    expect(
      evaluateSpecStale({
        method: 'GET',
        endpointUrl: 'http://x/new',
        importState: 'ok',
        fingerprintAtLastOkImport: fpOld,
      })
    ).toBe(SpecStaleReason.STRUCTURAL_DRIFT);
  });

  it('FRESH when fingerprint matches', () => {
    const url = 'http://x/a';
    const fp = structuralFingerprint('GET', url);
    expect(
      evaluateSpecStale({
        method: 'GET',
        endpointUrl: url,
        importState: 'ok',
        fingerprintAtLastOkImport: fp,
      })
    ).toBe(SpecStaleReason.FRESH);
  });
});

describe('staleReasonForBinding', () => {
  it('reads binding frozen meta', () => {
    const url = 'http://x/slots';
    const fp = structuralFingerprint('GET', url);
    const reason = staleReasonForBinding({
      bindingId: 'g:1',
      source: 'graph',
      taskId: 't1',
      endpointUrl: url,
      method: 'GET',
      frozenMeta: {
        lastImportedAt: '2020-01-01',
        specSourceUrl: url,
        contentHash: 'abc',
        importState: 'ok',
        structuralFingerprintAtLastOkImport: fp,
      },
      lastStructuralEditAt: '2020-01-02',
    });
    expect(reason).toBe(SpecStaleReason.FRESH);
  });
});
