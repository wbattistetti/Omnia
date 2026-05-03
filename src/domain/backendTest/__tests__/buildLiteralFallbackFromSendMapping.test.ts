import { describe, expect, it } from 'vitest';
import { buildLiteralFallbackFromSendMapping } from '../buildLiteralFallbackFromSendMapping';

describe('buildLiteralFallbackFromSendMapping', () => {
  it('maps wireKey to literal only', () => {
    expect(
      buildLiteralFallbackFromSendMapping([
        { wireKey: 'a', literalConstant: '1' },
        { wireKey: 'b', literalConstant: ' ' },
        { wireKey: 'c', variableRefId: 'x' },
      ])
    ).toEqual({ a: '1' });
  });
});
