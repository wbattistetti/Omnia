/**
 * Tests for tone token parsing helpers.
 */

import { describe, expect, it } from 'vitest';
import { parseToneTokenFromSection } from './aiAgentStructuredSectionEnums';

describe('parseToneTokenFromSection', () => {
  it('returns tone from first non-empty line', () => {
    expect(parseToneTokenFromSection('Tone: warm\n\nMore text')).toBe('warm');
  });

  it('is case-insensitive on Tone label', () => {
    expect(parseToneTokenFromSection('tone: formal')).toBe('formal');
  });

  it('returns undefined for unknown token', () => {
    expect(parseToneTokenFromSection('Tone: alien_mode')).toBeUndefined();
  });

  it('returns undefined when first line is not Tone', () => {
    expect(parseToneTokenFromSection('Hello world')).toBeUndefined();
  });
});
