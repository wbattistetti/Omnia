import { describe, expect, it } from 'vitest';
import {
  buildEmptyTutorGenerateHintLines,
  buildEmptyTutorGenerateHintSuffix,
} from '../buildEmptyTutorGenerateHint';

describe('buildEmptyTutorGenerateHintSuffix', () => {
  it('uses della/dei (not di la) after sulla base', () => {
    expect(
      buildEmptyTutorGenerateHintSuffix({
        hasDesignDescription: true,
        hasKbDocuments: false,
        hasBackend: false,
      })
    ).toBe('rigeneriamo da zero sulla base della descrizione che hai indicato.');

    expect(
      buildEmptyTutorGenerateHintSuffix({
        hasDesignDescription: true,
        hasKbDocuments: true,
        hasBackend: true,
      })
    ).toBe(
      'rigeneriamo da zero sulla base della descrizione che hai indicato, dei documenti che hai caricato e dei back-end che hai caricato.'
    );
  });

  it('fallback when nothing is configured', () => {
    expect(
      buildEmptyTutorGenerateHintSuffix({
        hasDesignDescription: false,
        hasKbDocuments: false,
        hasBackend: false,
      })
    ).toContain('quando avrai indicato la descrizione');
  });
});

describe('buildEmptyTutorGenerateHintLines', () => {
  it('splits action and sources for balanced UI lines', () => {
    const lines = buildEmptyTutorGenerateHintLines({
      hasDesignDescription: true,
      hasKbDocuments: true,
      hasBackend: true,
    });
    expect(lines.actionPhrase).toBe('rigeneriamo da zero');
    expect(lines.basesPhrase).toContain('sulla base della descrizione');
    expect(lines.basesPhrase).toContain('dei documenti');
    expect(lines.basesPhrase).not.toContain('di la ');
  });
});
