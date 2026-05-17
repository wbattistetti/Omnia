import { describe, expect, it } from 'vitest';
import { examplesFromPlainTexts, mergeStyleExamples, sortStyleExamplesByPlainText } from '../stylePhraseExamplesHelpers';

describe('stylePhraseExamplesHelpers', () => {
  it('sorts examples alphabetically by plainText', () => {
    const sorted = sortStyleExamplesByPlainText(
      examplesFromPlainTexts(['zebra', 'alfa'], 'combinatoric')
    );
    expect(sorted[0].plainText).toBe('alfa');
    expect(sorted[1].plainText).toBe('zebra');
  });

  it('mergeStyleExamples dedupes by plain text', () => {
    const a = examplesFromPlainTexts(['Ciao mondo'], 'combinatoric');
    const b = examplesFromPlainTexts(['ciao mondo'], 'polish');
    const merged = mergeStyleExamples(a, b);
    expect(merged).toHaveLength(1);
  });

  it('mergeStyleExamples dedupes when only punctuation differs', () => {
    const a = examplesFromPlainTexts(
      ['Grazie: RX ginocchio bilaterale, giusto?'],
      'combinatoric'
    );
    const b = examplesFromPlainTexts(
      ['Grazie RX ginocchio bilaterale giusto'],
      'polish'
    );
    const merged = mergeStyleExamples(a, b);
    expect(merged).toHaveLength(1);
  });

  it('examplesFromPlainTexts dedupes batch input', () => {
    const batch = examplesFromPlainTexts(
      ['Ciao, mondo!', 'Ciao mondo', 'ciao  mondo.'],
      'combinatoric'
    );
    expect(batch).toHaveLength(1);
  });
});
