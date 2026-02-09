// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { describe, it, expect } from 'vitest';
import {
  hasStepsContent,
} from '../steps';

// REMOVED: Tests for convertStepsArrayToDictionary and normalizeStepsToDictionary
// These functions were deprecated and removed. All code now uses dictionary format directly.

describe('Domain: Steps Operations', () => {

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
