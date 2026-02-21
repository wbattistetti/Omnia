// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { describe, it, expect } from 'vitest';
import {
  renderRegexForEditor,
  normalizeRegexFromEditor,
  buildDisplayMap,
  hasGuidGroupNames,
} from '../regexGroupTransform';
import type { SubDataMapping } from '../regexGroupTransform';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MAPPING_SIMPLE: SubDataMapping = {
  'sub-giorno': {
    canonicalKey: 'giorno',
    label: 'Giorno',
    groupName: 'g_1a2b3c4d5e6f',
    type: 'number',
  },
  'sub-mese': {
    canonicalKey: 'mese',
    label: 'Mese',
    groupName: 'g_2b3c4d5e6f7a',
    type: 'number',
  },
  'sub-anno': {
    canonicalKey: 'anno',
    label: 'Anno',
    groupName: 'g_3c4d5e6f7a8b',
    type: 'number',
  },
};

// Two sub-tasks with the same label to test collision handling
const MAPPING_COLLISION: SubDataMapping = {
  'sub-a': {
    canonicalKey: 'data_a',
    label: 'Data',
    groupName: 'g_aaaaaaaaaaaa',
    type: 'text',
  },
  'sub-b': {
    canonicalKey: 'data_b',
    label: 'Data',
    groupName: 'g_bbbbbbbbbbbb',
    type: 'text',
  },
  'sub-c': {
    canonicalKey: 'data_c',
    label: 'Data',
    groupName: 'g_cccccccccccc',
    type: 'text',
  },
};

// Label that needs sanitization (spaces and hyphens)
const MAPPING_SANITIZE: SubDataMapping = {
  'sub-x': {
    canonicalKey: 'birth_date',
    label: 'Birth Date',
    groupName: 'g_111111111111',
    type: 'date',
  },
  'sub-y': {
    canonicalKey: 'first-name',
    label: 'First-Name',
    groupName: 'g_222222222222',
    type: 'text',
  },
};

const GUID_REGEX_SIMPLE =
  '(?<g_1a2b3c4d5e6f>\\d{1,2})[/-](?<g_2b3c4d5e6f7a>\\d{1,2})[/-](?<g_3c4d5e6f7a8b>\\d{2,4})';

const LABEL_REGEX_SIMPLE =
  '(?<Giorno>\\d{1,2})[/-](?<Mese>\\d{1,2})[/-](?<Anno>\\d{2,4})';

// ---------------------------------------------------------------------------
// buildDisplayMap
// ---------------------------------------------------------------------------

describe('buildDisplayMap', () => {
  it('maps each GUID to a sanitized label', () => {
    const { guidToDisplay } = buildDisplayMap(MAPPING_SIMPLE);
    expect(guidToDisplay.get('g_1a2b3c4d5e6f')).toBe('Giorno');
    expect(guidToDisplay.get('g_2b3c4d5e6f7a')).toBe('Mese');
    expect(guidToDisplay.get('g_3c4d5e6f7a8b')).toBe('Anno');
  });

  it('maps each sanitized label back to the GUID', () => {
    const { displayToGuid } = buildDisplayMap(MAPPING_SIMPLE);
    expect(displayToGuid.get('Giorno')).toBe('g_1a2b3c4d5e6f');
    expect(displayToGuid.get('Mese')).toBe('g_2b3c4d5e6f7a');
    expect(displayToGuid.get('Anno')).toBe('g_3c4d5e6f7a8b');
  });

  it('resolves label collisions with numeric suffixes', () => {
    const { guidToDisplay, displayToGuid } = buildDisplayMap(MAPPING_COLLISION);

    // First occurrence keeps the bare name
    expect(guidToDisplay.get('g_aaaaaaaaaaaa')).toBe('Data');
    // Second occurrence gets _1
    expect(guidToDisplay.get('g_bbbbbbbbbbbb')).toBe('Data_1');
    // Third occurrence gets _2
    expect(guidToDisplay.get('g_cccccccccccc')).toBe('Data_2');

    // Inverse map is consistent
    expect(displayToGuid.get('Data')).toBe('g_aaaaaaaaaaaa');
    expect(displayToGuid.get('Data_1')).toBe('g_bbbbbbbbbbbb');
    expect(displayToGuid.get('Data_2')).toBe('g_cccccccccccc');
  });

  it('sanitizes labels with spaces and hyphens', () => {
    const { guidToDisplay } = buildDisplayMap(MAPPING_SANITIZE);
    expect(guidToDisplay.get('g_111111111111')).toBe('Birth_Date');
    expect(guidToDisplay.get('g_222222222222')).toBe('First_Name');
  });

  it('skips entries with missing or invalid groupName', () => {
    const mapping: SubDataMapping = {
      good: { canonicalKey: 'ok', label: 'OK', groupName: 'g_000000000000', type: 'text' },
      bad: { canonicalKey: 'nope', label: 'Nope', groupName: '', type: 'text' },
      ugly: { canonicalKey: 'ugly', label: 'Ugly', groupName: 'notaguuid', type: 'text' },
    };
    const { guidToDisplay } = buildDisplayMap(mapping);
    expect(guidToDisplay.size).toBe(1);
    expect(guidToDisplay.get('g_000000000000')).toBe('OK');
  });

  it('returns empty maps for an empty SubDataMapping', () => {
    const { guidToDisplay, displayToGuid } = buildDisplayMap({});
    expect(guidToDisplay.size).toBe(0);
    expect(displayToGuid.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// renderRegexForEditor (GUID → Label)
// ---------------------------------------------------------------------------

describe('renderRegexForEditor', () => {
  it('replaces GUID group names with label-based group names', () => {
    const result = renderRegexForEditor(GUID_REGEX_SIMPLE, MAPPING_SIMPLE);
    expect(result).toBe(LABEL_REGEX_SIMPLE);
  });

  it('handles GUID groups inside complex patterns', () => {
    const tech = `(?<g_1a2b3c4d5e6f>\\d+)?\\s*(?<g_2b3c4d5e6f7a>\\w+)?`;
    const display = renderRegexForEditor(tech, MAPPING_SIMPLE);
    expect(display).toBe('(?<Giorno>\\d+)?\\s*(?<Mese>\\w+)?');
  });

  it('returns the regex unchanged when subDataMapping is empty', () => {
    expect(renderRegexForEditor(GUID_REGEX_SIMPLE, {})).toBe(GUID_REGEX_SIMPLE);
  });

  it('returns the regex unchanged when it has no GUID groups', () => {
    const plain = '(.*)';
    expect(renderRegexForEditor(plain, MAPPING_SIMPLE)).toBe(plain);
  });

  it('returns an empty string when techRegex is empty', () => {
    expect(renderRegexForEditor('', MAPPING_SIMPLE)).toBe('');
  });

  it('renders collision labels with suffixes', () => {
    const tech = `(?<g_aaaaaaaaaaaa>.+)(?<g_bbbbbbbbbbbb>.+)(?<g_cccccccccccc>.+)`;
    const result = renderRegexForEditor(tech, MAPPING_COLLISION);
    expect(result).toBe('(?<Data>.+)(?<Data_1>.+)(?<Data_2>.+)');
  });

  it('renders sanitized labels (spaces → underscores)', () => {
    const tech = `(?<g_111111111111>\\d{4})-(?<g_222222222222>\\w+)`;
    const result = renderRegexForEditor(tech, MAPPING_SANITIZE);
    expect(result).toBe('(?<Birth_Date>\\d{4})-(?<First_Name>\\w+)');
  });
});

// ---------------------------------------------------------------------------
// normalizeRegexFromEditor (Label → GUID)
// ---------------------------------------------------------------------------

describe('normalizeRegexFromEditor', () => {
  it('replaces label group names with GUID group names', () => {
    const result = normalizeRegexFromEditor(LABEL_REGEX_SIMPLE, MAPPING_SIMPLE);
    expect(result).toBe(GUID_REGEX_SIMPLE);
  });

  it('handles label groups inside complex patterns', () => {
    const display = '(?<Giorno>\\d+)?\\s*(?<Mese>\\w+)?';
    const result = normalizeRegexFromEditor(display, MAPPING_SIMPLE);
    expect(result).toBe('(?<g_1a2b3c4d5e6f>\\d+)?\\s*(?<g_2b3c4d5e6f7a>\\w+)?');
  });

  it('returns the regex unchanged when subDataMapping is empty', () => {
    expect(normalizeRegexFromEditor(LABEL_REGEX_SIMPLE, {})).toBe(LABEL_REGEX_SIMPLE);
  });

  it('returns the regex unchanged when it has no named groups', () => {
    const plain = '(.*)';
    expect(normalizeRegexFromEditor(plain, MAPPING_SIMPLE)).toBe(plain);
  });

  it('returns an empty string when humanRegex is empty', () => {
    expect(normalizeRegexFromEditor('', MAPPING_SIMPLE)).toBe('');
  });

  it('normalizes collision-suffixed labels correctly', () => {
    const display = '(?<Data>.+)(?<Data_1>.+)(?<Data_2>.+)';
    const result = normalizeRegexFromEditor(display, MAPPING_COLLISION);
    expect(result).toBe(
      '(?<g_aaaaaaaaaaaa>.+)(?<g_bbbbbbbbbbbb>.+)(?<g_cccccccccccc>.+)'
    );
  });

  it('normalizes sanitized labels correctly', () => {
    const display = '(?<Birth_Date>\\d{4})-(?<First_Name>\\w+)';
    const result = normalizeRegexFromEditor(display, MAPPING_SANITIZE);
    expect(result).toBe('(?<g_111111111111>\\d{4})-(?<g_222222222222>\\w+)');
  });

  it('throws when the user invents an unknown label', () => {
    const badDisplay = '(?<Giorno>\\d{1,2})[/-](?<Invented>\\d{1,2})';
    expect(() => normalizeRegexFromEditor(badDisplay, MAPPING_SIMPLE)).toThrow(
      /Unrecognized group name\(s\)/
    );
  });

  it('throws when the user renames an existing label', () => {
    // "GiornoModificato" is not in the mapping
    const renamed = '(?<GiornoModificato>\\d{1,2})[/-](?<Mese>\\d{1,2})';
    expect(() => normalizeRegexFromEditor(renamed, MAPPING_SIMPLE)).toThrow(
      /Unrecognized group name\(s\)/
    );
  });

  it('error message lists all valid labels', () => {
    const badDisplay = '(?<Unknown>\\d+)';
    let errorMessage = '';
    try {
      normalizeRegexFromEditor(badDisplay, MAPPING_SIMPLE);
    } catch (e) {
      errorMessage = (e as Error).message;
    }
    expect(errorMessage).toContain('Giorno');
    expect(errorMessage).toContain('Mese');
    expect(errorMessage).toContain('Anno');
  });
});

// ---------------------------------------------------------------------------
// Round-trip: GUID → Label → GUID
// ---------------------------------------------------------------------------

describe('Round-trip: GUID → Label → GUID', () => {
  it('round-trip is perfect for the simple date regex', () => {
    const label = renderRegexForEditor(GUID_REGEX_SIMPLE, MAPPING_SIMPLE);
    const tech = normalizeRegexFromEditor(label, MAPPING_SIMPLE);
    expect(tech).toBe(GUID_REGEX_SIMPLE);
  });

  it('round-trip is perfect for collision labels', () => {
    const orig = '(?<g_aaaaaaaaaaaa>.+)(?<g_bbbbbbbbbbbb>.+)(?<g_cccccccccccc>.+)';
    const label = renderRegexForEditor(orig, MAPPING_COLLISION);
    const tech = normalizeRegexFromEditor(label, MAPPING_COLLISION);
    expect(tech).toBe(orig);
  });

  it('round-trip is perfect for sanitized labels', () => {
    const orig = '(?<g_111111111111>\\d{4})-(?<g_222222222222>\\w+)';
    const label = renderRegexForEditor(orig, MAPPING_SANITIZE);
    const tech = normalizeRegexFromEditor(label, MAPPING_SANITIZE);
    expect(tech).toBe(orig);
  });

  it('round-trip preserves parts of the regex that have no named groups', () => {
    const orig = `^(?<g_1a2b3c4d5e6f>\\d{1,2})[/\\-.](?<g_2b3c4d5e6f7a>\\d{1,2})[/\\-.](?<g_3c4d5e6f7a8b>\\d{4})$`;
    const label = renderRegexForEditor(orig, MAPPING_SIMPLE);
    const tech = normalizeRegexFromEditor(label, MAPPING_SIMPLE);
    expect(tech).toBe(orig);
  });

  it('round-trip works for a regex with a single group', () => {
    const mapping: SubDataMapping = {
      only: { canonicalKey: 'val', label: 'Value', groupName: 'g_abcdef012345', type: 'text' },
    };
    const orig = '(?<g_abcdef012345>.+)';
    const label = renderRegexForEditor(orig, mapping);
    expect(label).toBe('(?<Value>.+)');
    const tech = normalizeRegexFromEditor(label, mapping);
    expect(tech).toBe(orig);
  });
});

// ---------------------------------------------------------------------------
// hasGuidGroupNames
// ---------------------------------------------------------------------------

describe('hasGuidGroupNames', () => {
  it('returns true for a regex with at least one GUID group', () => {
    expect(hasGuidGroupNames('(?<g_1a2b3c4d5e6f>\\d+)')).toBe(true);
  });

  it('returns false for a regex with only label groups', () => {
    expect(hasGuidGroupNames('(?<Giorno>\\d+)')).toBe(false);
  });

  it('returns false for a regex with no named groups', () => {
    expect(hasGuidGroupNames('(\\d+)')).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(hasGuidGroupNames('')).toBe(false);
  });

  it('returns true even when mixed with non-GUID groups', () => {
    expect(hasGuidGroupNames('(?<label>\\w+)(?<g_aabbccddeeff>\\d+)')).toBe(true);
  });
});
