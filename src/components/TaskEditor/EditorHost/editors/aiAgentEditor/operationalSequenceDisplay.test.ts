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

  it('returns single block when no step pattern', () => {
    expect(formatOperationalSequenceNewlines('solo testo')).toBe('solo testo');
  });
});

describe('splitOperationalSequenceLines', () => {
  it('matches lines after format', () => {
    const lines = splitOperationalSequenceLines('1. x 2. y');
    expect(lines).toEqual(['1. x', '2. y']);
  });
});
