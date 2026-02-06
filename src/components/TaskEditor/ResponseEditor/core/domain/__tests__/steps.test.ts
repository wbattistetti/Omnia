// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { describe, it, expect } from 'vitest';
import {
  convertStepsArrayToDictionary,
  normalizeStepsToDictionary,
  hasStepsContent,
} from '../steps';

describe('Domain: Steps Operations', () => {
  describe('convertStepsArrayToDictionary', () => {
    it('should return empty object for null', () => {
      const result = convertStepsArrayToDictionary(null);
      expect(result).toEqual({});
    });

    it('should return empty object for undefined', () => {
      const result = convertStepsArrayToDictionary(undefined);
      expect(result).toEqual({});
    });

    it('should return dictionary as-is when already dictionary format', () => {
      const dictionary = {
        start: { type: 'start', escalations: [] },
        noMatch: { type: 'noMatch', escalations: [] },
      };
      const result = convertStepsArrayToDictionary(dictionary);
      expect(result).toEqual(dictionary);
    });

    it('should convert array to dictionary', () => {
      const array = [
        { type: 'start', escalations: [], id: 'start-id' },
        { type: 'noMatch', escalations: [], id: 'noMatch-id' },
        { type: 'success', escalations: [], id: 'success-id' },
      ];
      const result = convertStepsArrayToDictionary(array);

      expect(result).toEqual({
        start: { type: 'start', escalations: [], id: 'start-id' },
        noMatch: { type: 'noMatch', escalations: [], id: 'noMatch-id' },
        success: { type: 'success', escalations: [], id: 'success-id' },
      });
    });

    it('should handle empty array', () => {
      const result = convertStepsArrayToDictionary([]);
      expect(result).toEqual({});
    });

    it('should skip steps without type', () => {
      const array = [
        { type: 'start', escalations: [] },
        { escalations: [] }, // No type
        { type: 'noMatch', escalations: [] },
        { type: null, escalations: [] }, // Null type
      ];
      const result = convertStepsArrayToDictionary(array);

      expect(result).toHaveProperty('start');
      expect(result).toHaveProperty('noMatch');
      expect(result).not.toHaveProperty('undefined');
      expect(Object.keys(result)).toHaveLength(2);
    });

    it('should handle steps with empty escalations', () => {
      const array = [
        { type: 'start', escalations: [] },
        { type: 'noMatch', escalations: [] },
      ];
      const result = convertStepsArrayToDictionary(array);

      expect(result.start.escalations).toEqual([]);
      expect(result.noMatch.escalations).toEqual([]);
    });

    it('should handle steps with escalations', () => {
      const escalations = [{ escalationId: 'esc-1', tasks: [] }];
      const array = [
        { type: 'start', escalations, id: 'start-id' },
      ];
      const result = convertStepsArrayToDictionary(array);

      expect(result.start.escalations).toEqual(escalations);
    });

    it('should preserve step id when available', () => {
      const array = [
        { type: 'start', id: 'custom-start-id', escalations: [] },
        { type: 'noMatch', escalations: [] }, // No id
      ];
      const result = convertStepsArrayToDictionary(array);

      expect(result.start.id).toBe('custom-start-id');
      expect(result.noMatch.id).toBeUndefined();
    });

    it('should handle mixed array with valid and invalid steps', () => {
      const array = [
        { type: 'start', escalations: [] },
        null,
        undefined,
        { type: 'noMatch', escalations: [] },
        { type: '', escalations: [] }, // Empty type
      ];
      const result = convertStepsArrayToDictionary(array);

      expect(result).toHaveProperty('start');
      expect(result).toHaveProperty('noMatch');
      expect(Object.keys(result)).toHaveLength(2);
    });

    it('should handle duplicate types (last one wins)', () => {
      const array = [
        { type: 'start', escalations: [], id: 'first' },
        { type: 'start', escalations: [], id: 'second' },
      ];
      const result = convertStepsArrayToDictionary(array);

      expect(result.start.id).toBe('second');
    });
  });

  describe('normalizeStepsToDictionary', () => {
    it('should return same result as convertStepsArrayToDictionary', () => {
      const array = [
        { type: 'start', escalations: [] },
        { type: 'noMatch', escalations: [] },
      ];
      const result1 = normalizeStepsToDictionary(array);
      const result2 = convertStepsArrayToDictionary(array);
      expect(result1).toEqual(result2);
    });

    it('should handle dictionary format', () => {
      const dictionary = {
        start: { type: 'start', escalations: [] },
      };
      const result = normalizeStepsToDictionary(dictionary);
      expect(result).toEqual(dictionary);
    });

    it('should handle array format', () => {
      const array = [
        { type: 'start', escalations: [] },
      ];
      const result = normalizeStepsToDictionary(array);
      expect(result).toEqual({
        start: { type: 'start', escalations: [] },
      });
    });

    it('should handle null', () => {
      const result = normalizeStepsToDictionary(null);
      expect(result).toEqual({});
    });
  });

  describe('hasStepsContent', () => {
    it('should return false for null', () => {
      const result = hasStepsContent(null);
      expect(result).toBe(false);
    });

    it('should return false for undefined', () => {
      const result = hasStepsContent(undefined);
      expect(result).toBe(false);
    });

    it('should return false for empty dictionary', () => {
      const result = hasStepsContent({});
      expect(result).toBe(false);
    });

    it('should return false for empty array', () => {
      const result = hasStepsContent([]);
      expect(result).toBe(false);
    });

    it('should return true for dictionary with content', () => {
      const dictionary = {
        start: { type: 'start', escalations: [] },
      };
      const result = hasStepsContent(dictionary);
      expect(result).toBe(true);
    });

    it('should return true for array with content', () => {
      const array = [
        { type: 'start', escalations: [] },
      ];
      const result = hasStepsContent(array);
      expect(result).toBe(true);
    });

    it('should return true for dictionary with multiple steps', () => {
      const dictionary = {
        start: { type: 'start', escalations: [] },
        noMatch: { type: 'noMatch', escalations: [] },
        success: { type: 'success', escalations: [] },
      };
      const result = hasStepsContent(dictionary);
      expect(result).toBe(true);
    });

    it('should return true for array with multiple steps', () => {
      const array = [
        { type: 'start', escalations: [] },
        { type: 'noMatch', escalations: [] },
      ];
      const result = hasStepsContent(array);
      expect(result).toBe(true);
    });

    it('should return false for non-object, non-array values', () => {
      expect(hasStepsContent('string')).toBe(false);
      expect(hasStepsContent(123)).toBe(false);
      expect(hasStepsContent(true)).toBe(false);
      expect(hasStepsContent(false)).toBe(false);
    });

    it('should handle dictionary with null values', () => {
      const dictionary = {
        start: null,
        noMatch: { type: 'noMatch', escalations: [] },
      };
      const result = hasStepsContent(dictionary);
      // Should return true because dictionary has keys
      expect(result).toBe(true);
    });
  });
});
