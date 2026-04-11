import { describe, expect, it } from 'vitest';
import { shouldSkipInterfaceDuplicate } from '../interfaceMappingLabels';

describe('shouldSkipInterfaceDuplicate', () => {
  it('returns true when same variableRefId exists', () => {
    expect(
      shouldSkipInterfaceDuplicate(
        [{ variableRefId: 'abc', wireKey: 'iface_1' }],
        { variableRefId: 'abc', wireKey: 'iface_2' }
      )
    ).toBe(true);
  });

  it('returns false when variableRefId is new', () => {
    expect(
      shouldSkipInterfaceDuplicate(
        [{ variableRefId: 'abc', wireKey: 'iface_1' }],
        { variableRefId: 'def', wireKey: 'iface_2' }
      )
    ).toBe(false);
  });

  it('dedupes by wireKey when variableRefId is absent', () => {
    expect(shouldSkipInterfaceDuplicate([{ wireKey: 'only_path' }], { wireKey: 'only_path' })).toBe(true);
  });
});
