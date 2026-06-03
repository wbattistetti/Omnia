import { describe, expect, it } from 'vitest';
import {
  catalogHasCompileMappingInputs,
  shouldRunBackendIaCompileMapping,
  shouldRunIaCompileSlotMapping,
} from '../catalogCompileBackendGate';

describe('catalogCompileBackendGate', () => {
  it('catalogHasCompileMappingInputs is true when surfaces or tokens exist', () => {
    expect(catalogHasCompileMappingInputs({ surfaceCount: 0, phraseTokenCount: 0 })).toBe(false);
    expect(catalogHasCompileMappingInputs({ surfaceCount: 1, phraseTokenCount: 0 })).toBe(true);
    expect(catalogHasCompileMappingInputs({ surfaceCount: 0, phraseTokenCount: 2 })).toBe(true);
  });

  it('shouldRunIaCompileSlotMapping runs when surfaces or tokens exist (no backend required)', () => {
    const inputs = { surfaceCount: 3, phraseTokenCount: 1 };
    expect(shouldRunIaCompileSlotMapping(inputs)).toBe(true);
    expect(shouldRunIaCompileSlotMapping({ surfaceCount: 0, phraseTokenCount: 0 })).toBe(false);
    expect(shouldRunBackendIaCompileMapping(inputs, false)).toBe(true);
  });
});
