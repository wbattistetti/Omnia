/**
 * Tests for operational sequence newline formatting.
 */

import { describe, expect, it } from 'vitest';
import {
  formatOperationalSequenceNewlines,
  splitOperationalSequenceLines,
} from './operationalSequenceDisplay';

describe('formatOperationalSequenceNewlines', () => {
  it('inserts newlines between numbered steps on one line', () => {
    const oneLine =
      '1. Chiedere il tipo di visita. 2. Proporre date disponibili. 3. Raccogliere il nome.';
    const out = formatOperationalSequenceNewlines(oneLine);
    expect(out.split('\n')).toHaveLength(3);
    expect(out).toContain('1.');
    expect(out).toContain('2.');
    expect(out).toContain('3.');
  });

  it('keeps already multiline text (trimmed lines)', () => {
    const ml = '1. a\n\n2. b';
    expect(formatOperationalSequenceNewlines(ml)).toBe('1. a\n2. b');
  });

  it('prefixes a single line with a bullet for scanability', () => {
    expect(formatOperationalSequenceNewlines('solo testo')).toBe('- solo testo');
  });

  it('splits long prose into sentence bullets', () => {
    const prose =
      'Chiedere il tipo di visita. Verificare disponibilità. Confermare con il paziente prima di procedere.';
    const out = formatOperationalSequenceNewlines(prose);
    expect(out.split('\n').length).toBeGreaterThanOrEqual(3);
    expect(out).toMatch(/^- /m);
  });
});

describe('splitOperationalSequenceLines', () => {
  it('matches lines after format', () => {
    const lines = splitOperationalSequenceLines('1. x 2. y');
    expect(lines).toEqual(['1. x', '2. y']);
  });
});
