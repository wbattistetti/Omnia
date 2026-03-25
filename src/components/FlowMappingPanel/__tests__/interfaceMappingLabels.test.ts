import { describe, expect, it } from 'vitest';
import {
  computeInterfaceEntryLabels,
  getInterfaceLeafDisplayName,
  shouldSkipInterfaceDuplicate,
} from '../interfaceMappingLabels';
import { createMappingEntry } from '../mappingTypes';

describe('shouldSkipInterfaceDuplicate', () => {
  it('returns true when same variableRefId exists', () => {
    expect(
      shouldSkipInterfaceDuplicate(
        [{ variableRefId: 'abc', internalPath: 'iface_1' }],
        { variableRefId: 'abc', internalPath: 'iface_2' }
      )
    ).toBe(true);
  });

  it('returns false when variableRefId is new', () => {
    expect(
      shouldSkipInterfaceDuplicate(
        [{ variableRefId: 'abc', internalPath: 'iface_1' }],
        { variableRefId: 'def', internalPath: 'iface_2' }
      )
    ).toBe(false);
  });

  it('dedupes by internalPath when variableRefId is absent', () => {
    expect(
      shouldSkipInterfaceDuplicate([{ internalPath: 'only_path' }], { internalPath: 'only_path' })
    ).toBe(true);
  });
});

describe('getInterfaceLeafDisplayName', () => {
  it('falls back to linkedVariable when store empty', () => {
    const e = createMappingEntry({
      internalPath: 'iface_x',
      linkedVariable: 'via',
      externalName: 'via',
    });
    expect(getInterfaceLeafDisplayName(e, 'no-such-project')).toBe('via');
  });
});

describe('computeInterfaceEntryLabels', () => {
  it('falls back to normalizeTaskLabel when store has no varName', () => {
    const { externalName, linkedVariable } = computeInterfaceEntryLabels(
      'nonexistent-project-xyz',
      '00000000-0000-4000-8000-000000000001',
      'chiedi numero civico',
      'iface_x'
    );
    expect(externalName).toContain('numero');
    expect(externalName.toLowerCase()).not.toMatch(/^chiedi\b/);
    expect(linkedVariable).toBe(externalName);
  });
});
