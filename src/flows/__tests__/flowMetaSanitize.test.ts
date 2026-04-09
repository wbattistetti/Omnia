import { describe, expect, it } from 'vitest';
import { stripLegacyVariablesFromFlowMeta } from '../flowMetaSanitize';

describe('stripLegacyVariablesFromFlowMeta', () => {
  it('removes variables and keeps other keys', () => {
    const out = stripLegacyVariablesFromFlowMeta({
      variables: [{ id: 'x' }],
      flowInterface: { input: [], output: [] },
    } as any);
    expect(out).toEqual({ flowInterface: { input: [], output: [] } });
    expect((out as any)?.variables).toBeUndefined();
  });

  it('returns undefined when only variables remained', () => {
    expect(stripLegacyVariablesFromFlowMeta({ variables: [] })).toBeUndefined();
  });
});
