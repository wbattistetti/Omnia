import { describe, expect, it } from 'vitest';
import {
  buildInternalReferenceHaystackForParentFlow,
  conditionExpressionTextForReferenceScan,
  REFERENCE_SCAN_INTERNAL_TEXT_KEY,
} from '../internalReferenceHaystack';

describe('internalReferenceHaystack (scan-only)', () => {
  const guidNome = '11111111-1111-4111-8111-111111111111';
  const guidEta = '22222222-2222-4222-8222-222222222222';
  const guidX = '33333333-3333-4333-8333-333333333333';

  it('conditionExpressionTextForReferenceScan prefers internalReferenceText; never raw script', () => {
    expect(
      conditionExpressionTextForReferenceScan({
        compiledCode: 'return ctx["x"]',
        script: '[label]',
        executableCode: '[y]',
      })
    ).toBe('return ctx["x"]');
    expect(conditionExpressionTextForReferenceScan({ executableCode: '[z]', script: 'S' })).toBe('[z]');
    expect(conditionExpressionTextForReferenceScan({ script: 'only' })).toBe('');
    expect(
      conditionExpressionTextForReferenceScan({ internalReferenceText: ' GUID blob ', script: 'only' })
    ).toBe('GUID blob');
  });

  it('buildInternalReferenceHaystackForParentFlow concatenates GUID blobs only', () => {
    const hay = buildInternalReferenceHaystackForParentFlow({
      conditionInternalTexts: [`[${guidEta}] > 0`],
      taskJsonChunks: [
        JSON.stringify({
          [REFERENCE_SCAN_INTERNAL_TEXT_KEY]: `{{${guidNome}}}`,
        }),
      ],
      translationsInternal: { k: `x ${guidEta} y` },
    });
    expect(hay).toContain(guidEta);
    expect(hay).toContain(guidNome);
  });

  it('buildInternalReferenceHaystackForParentFlow includes referenceScanInternalText from task JSON (no full-task JSON blob)', () => {
    const taskJson = JSON.stringify({
      [REFERENCE_SCAN_INTERNAL_TEXT_KEY]: `only-${guidX}-blob`,
      displayText: '{{nome}}',
    });
    const hay = buildInternalReferenceHaystackForParentFlow({
      conditionInternalTexts: [],
      taskJsonChunks: [taskJson],
    });
    expect(hay).toContain(guidX);
    expect(hay).toContain(`only-${guidX}-blob`);
    expect(hay).not.toContain('displayText');
  });
});
