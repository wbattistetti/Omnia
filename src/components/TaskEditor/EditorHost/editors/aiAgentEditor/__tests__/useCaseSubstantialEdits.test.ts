/**
 * Test per `useCaseSubstantialEdits`:
 *  - distanza a parole simmetrica e su edge cases (vuoti);
 *  - `isSubstantialEdit` non considera baseline mancante come "sostanziale";
 *  - count cross-use-case somma i campi (non gli use case).
 */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SUBSTANTIAL_EDIT_WORD_THRESHOLD,
  countSubstantialEditsAcrossUseCases,
  fieldsWithSubstantialEdits,
  isCompletaCorrezioneCalloutSurfaceActive,
  isSubstantialEdit,
  tokenizeWords,
  wordEditDistance,
} from '../useCaseSubstantialEdits';

describe('isCompletaCorrezioneCalloutSurfaceActive', () => {
  it('true quando count >= soglia e non dismissato', () => {
    expect(
      isCompletaCorrezioneCalloutSurfaceActive({
        pendingCorrectionsCount: 1,
        correctionsDismissed: false,
        correctionsBusy: false,
      })
    ).toBe(true);
  });
  it('false quando dismissato anche con count alto', () => {
    expect(
      isCompletaCorrezioneCalloutSurfaceActive({
        pendingCorrectionsCount: 3,
        correctionsDismissed: true,
        correctionsBusy: false,
      })
    ).toBe(false);
  });
  it('true quando busy anche se dismissato o count basso (spinner fino a fine)', () => {
    expect(
      isCompletaCorrezioneCalloutSurfaceActive({
        pendingCorrectionsCount: 0,
        correctionsDismissed: true,
        correctionsBusy: true,
      })
    ).toBe(true);
  });
  it('false quando sotto soglia e non busy', () => {
    expect(
      isCompletaCorrezioneCalloutSurfaceActive({
        pendingCorrectionsCount: 0,
        correctionsDismissed: false,
        correctionsBusy: false,
      })
    ).toBe(false);
  });
});

describe('tokenizeWords', () => {
  it('split su whitespace e rimuove vuoti', () => {
    expect(tokenizeWords('  ciao   mondo\n bello  ')).toEqual(['ciao', 'mondo', 'bello']);
  });
  it('stringa vuota → array vuoto', () => {
    expect(tokenizeWords('')).toEqual([]);
    expect(tokenizeWords('   \n\t')).toEqual([]);
  });
});

describe('wordEditDistance', () => {
  it('zero quando uguali', () => {
    expect(wordEditDistance(['a', 'b'], ['a', 'b'])).toBe(0);
  });
  it('insert + delete', () => {
    expect(wordEditDistance(['a', 'b', 'c'], ['a', 'c'])).toBe(1);
    expect(wordEditDistance([], ['a', 'b', 'c'])).toBe(3);
  });
  it('substitutions a costo unitario', () => {
    expect(wordEditDistance(['a', 'b', 'c'], ['a', 'X', 'c'])).toBe(1);
    expect(wordEditDistance(['a', 'b', 'c'], ['X', 'Y', 'Z'])).toBe(3);
  });
});

describe('isSubstantialEdit', () => {
  it('baseline assente → mai sostanziale', () => {
    expect(isSubstantialEdit('qualunque cosa', undefined)).toBe(false);
  });
  it('uguale alla baseline → non sostanziale', () => {
    expect(isSubstantialEdit('ciao mondo', 'ciao mondo')).toBe(false);
  });
  it('1-2 parole cambiate (sotto soglia 3) → non sostanziale', () => {
    expect(isSubstantialEdit('ciao mondo bello', 'ciao mondo grande')).toBe(false);
    expect(isSubstantialEdit('a b c d e', 'a b X Y e')).toBe(false);
  });
  it('≥ 3 parole cambiate → sostanziale', () => {
    expect(isSubstantialEdit('a b c d e', 'X Y Z d e')).toBe(true);
  });
  it('soglia configurabile', () => {
    expect(isSubstantialEdit('a b', 'X Y', 1)).toBe(true);
    expect(isSubstantialEdit('a b', 'X Y', 5)).toBe(false);
  });
});

describe('fieldsWithSubstantialEdits', () => {
  it('valuta scenario e agentMessage in modo indipendente', () => {
    const r = fieldsWithSubstantialEdits(
      { scenario: 'a b c d', agentMessage: 'identico testo qui' },
      { label: 'L', payoff: 'X Y Z W', assistantContent: 'identico testo qui' }
    );
    expect(r).toEqual({ scenario: true, agentMessage: false });
  });
});

describe('countSubstantialEditsAcrossUseCases', () => {
  it('somma i campi modificati, non gli use case', () => {
    const total = countSubstantialEditsAcrossUseCases([
      {
        id: 'u1',
        current: { scenario: 'a b c d', agentMessage: 'X Y Z W' },
        baseline: { label: 'L1', payoff: 'lorem ipsum dolor sit', assistantContent: 'q w e r' },
      },
      {
        id: 'u2',
        current: { scenario: 'invariato', agentMessage: 'invariato' },
        baseline: { label: 'L2', payoff: 'invariato', assistantContent: 'invariato' },
      },
    ]);
    expect(total).toBe(2);
  });
  it('soglia di default è 3', () => {
    expect(DEFAULT_SUBSTANTIAL_EDIT_WORD_THRESHOLD).toBe(3);
  });
});
