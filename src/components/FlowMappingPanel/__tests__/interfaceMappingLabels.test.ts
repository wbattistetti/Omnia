import { describe, expect, it } from 'vitest';
import { getInterfaceTreeRowDisplayLabel } from '../interfaceMappingLabels';
import { createMappingEntry } from '../mappingTypes';

describe('getInterfaceTreeRowDisplayLabel', () => {
  it('uses tree segment for wireKey-only rows (not full path)', () => {
    const entry = createMappingEntry({ wireKey: 'agenda.json' });
    expect(getInterfaceTreeRowDisplayLabel(entry, 'json', undefined)).toBe('json');
  });

  it('uses parent segment for grouped paths', () => {
    const entry = createMappingEntry({ wireKey: 'horizon.end' });
    expect(getInterfaceTreeRowDisplayLabel(entry, 'end', undefined)).toBe('end');
  });
});
