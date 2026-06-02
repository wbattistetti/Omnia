import { describe, expect, it } from 'vitest';
import {
  catalogHasCompileMappingInputs,
  shouldRunBackendIaCompileMapping,
} from '../catalogCompileBackendGate';

describe('catalogCompileBackendGate', () => {
  it('catalogHasCompileMappingInputs is true when surfaces or tokens exist', () => {
    expect(catalogHasCompileMappingInputs({ surfaceCount: 0, phraseTokenCount: 0 })).toBe(false);
    expect(catalogHasCompileMappingInputs({ surfaceCount: 1, phraseTokenCount: 0 })).toBe(true);
    expect(catalogHasCompileMappingInputs({ surfaceCount: 0, phraseTokenCount: 2 })).toBe(true);
  });

  it('shouldRunBackendIaCompileMapping requires backend when inputs exist', () => {
    const inputs = { surfaceCount: 3, phraseTokenCount: 1 };
    expect(shouldRunBackendIaCompileMapping(inputs, false)).toBe(false);
    expect(shouldRunBackendIaCompileMapping(inputs, true)).toBe(true);
    expect(
      shouldRunBackendIaCompileMapping({ surfaceCount: 0, phraseTokenCount: 0 }, true)
    ).toBe(false);
  });
});
