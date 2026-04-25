import { SELECTABLE_LANGUAGE_CODES } from '../modelCostsCatalog';

describe('SELECTABLE_LANGUAGE_CODES', () => {
  it('includes merged ISO codes sorted', () => {
    expect(SELECTABLE_LANGUAGE_CODES.length).toBeGreaterThan(10);
    expect(SELECTABLE_LANGUAGE_CODES).toContain('en');
    const sorted = [...SELECTABLE_LANGUAGE_CODES].sort((a, b) => a.localeCompare(b));
    expect(SELECTABLE_LANGUAGE_CODES).toEqual(sorted);
  });
});
