import { normalizeConstraint, enrichAndTranslateConstraints } from '../ConstraintBuilder';
import { v4 as uuidv4 } from 'uuid';

jest.mock('uuid', () => ({ v4: () => 'mock-uuid' }));

describe('ConstraintBuilder', () => {
  describe('normalizeConstraint', () => {
    it('should fill missing fields', () => {
      const input = { type: 'required' };
      const norm = normalizeConstraint(input);
      expect(norm.id).toBe('mock-uuid');
      expect(norm.label).toBe('required');
      expect(norm.prompts).toEqual([]);
      expect(norm.validationScript).toBe('');
      expect(norm.testSet).toEqual([]);
    });
    it('should preserve existing fields', () => {
      const input = { id: 'c1', type: 'range', label: 'Range', prompts: ['A'], validationScript: 'x', testSet: [1] };
      const norm = normalizeConstraint(input);
      expect(norm.id).toBe('c1');
      expect(norm.label).toBe('Range');
      expect(norm.prompts).toEqual(['A']);
      expect(norm.validationScript).toBe('x');
      expect(norm.testSet).toEqual([1]);
    });
  });

  describe('enrichAndTranslateConstraints', () => {
    it('should normalize constraints and add prompt translations', () => {
      const constraints = [
        { type: 'required', prompts: ['P1', 'P2'] },
        { type: 'range', prompts: ['P3'] }
      ];
      const translations: Record<string, string> = {};
      const ddtId = 'ddt_test';
      const enriched = enrichAndTranslateConstraints(constraints, ddtId, translations);
      expect(enriched.length).toBe(2);
      expect(enriched[0].prompts.length).toBe(2);
      expect(enriched[1].prompts.length).toBe(1);
      // Check that translations were added
      expect(Object.keys(translations)).toEqual([
        'runtime.ddt_test.constraint#mock-uuid.prompt#1',
        'runtime.ddt_test.constraint#mock-uuid.prompt#2',
        'runtime.ddt_test.constraint#mock-uuid.prompt#1'
      ]);
      expect(translations['runtime.ddt_test.constraint#mock-uuid.prompt#1']).toBe('P3'); // last wins
      expect(translations['runtime.ddt_test.constraint#mock-uuid.prompt#2']).toBe('P2');
    });
  });
});