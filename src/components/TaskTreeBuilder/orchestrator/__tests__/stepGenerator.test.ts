import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateSteps, generateStepsSkipDetectType } from '../stepGenerator';
import type { DataNode } from '../stepGenerator';

// Mock fetch globally
(global as any).fetch = vi.fn();

describe('stepGenerator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateSteps', () => {
    it('should generate all steps for a data node', () => {
      const dataNode: DataNode = {
        name: 'birthDate',
        type: 'date'
      };

      const steps = generateSteps(dataNode);

      expect(steps).toHaveLength(7);
      expect(steps[0].key).toBe('detectType');
      expect(steps[1].key).toBe('suggestStructureAndConstraints');
      expect(steps[2].key).toBe('startPrompt');
      expect(steps[3].key).toBe('noMatchPrompts');
      expect(steps[4].key).toBe('noInputPrompts');
      expect(steps[5].key).toBe('confirmationPrompts');
      expect(steps[6].key).toBe('successPrompts');
    });

    it('should generate steps with correct properties', () => {
      const dataNode: DataNode = {
        name: 'email',
        type: 'string'
      };

      const steps = generateSteps(dataNode);
      const firstStep = steps[0];

      expect(firstStep).toHaveProperty('key');
      expect(firstStep).toHaveProperty('label');
      expect(firstStep).toHaveProperty('payoff');
      expect(firstStep).toHaveProperty('type');
      expect(firstStep).toHaveProperty('run');
      expect(typeof firstStep.run).toBe('function');
    });

    it('should generate subData steps when subdata is present', () => {
      const dataNode: DataNode = {
        name: 'birthDate',
        type: 'date',
        subdata: [
          { name: 'day', type: 'number' },
          { name: 'month', type: 'number' },
          { name: 'year', type: 'number' }
        ]
      };

      const steps = generateSteps(dataNode);

      // 7 base steps + 6 subData steps (2 per subData: messages + scripts)
      expect(steps).toHaveLength(13);

      // Verify base steps are still present
      expect(steps[0].key).toBe('detectType');
      expect(steps[1].key).toBe('suggestStructureAndConstraints');

      // Verify subData steps are added
      const subDataSteps = steps.filter(step =>
        step.key.includes('subDataMessages_') || step.key.includes('subDataScripts_')
      );
      expect(subDataSteps).toHaveLength(6);

      // Verify specific subData steps
      expect(steps.some(step => step.key === 'subDataMessages_day_0')).toBe(true);
      expect(steps.some(step => step.key === 'subDataScripts_day_0')).toBe(true);
      expect(steps.some(step => step.key === 'subDataMessages_month_1')).toBe(true);
      expect(steps.some(step => step.key === 'subDataScripts_month_1')).toBe(true);
      expect(steps.some(step => step.key === 'subDataMessages_year_2')).toBe(true);
      expect(steps.some(step => step.key === 'subDataScripts_year_2')).toBe(true);
    });

    it('should include subDataInfo in subData steps', () => {
      const mockDataNode = {
        name: 'birthDate',
        type: 'date',
        subData: [
          {
            name: 'day',
            type: 'number',
            constraints: ['range']
          }
        ]
      };

      const steps = generateSteps(mockDataNode);

      // Find subData message and script steps
      const subDataMessageStep = steps.find(step => step.key === 'subDataMessages_day_0');
      const subDataScriptStep = steps.find(step => step.key === 'subDataScripts_day_0');

      expect(subDataMessageStep).toBeDefined();
      expect(subDataScriptStep).toBeDefined();

      expect(subDataMessageStep?.subDataInfo).toEqual({ name: 'day', type: 'number', constraints: ['range'] });
      expect(subDataMessageStep?.subDataIndex).toBe(0);
      expect(subDataScriptStep?.subDataInfo).toEqual({ name: 'day', type: 'number', constraints: ['range'] });
      expect(subDataScriptStep?.subDataIndex).toBe(0);
    });
  });

  describe('generateStepsSkipDetectType', () => {
    it('should skip detectType step when skipDetectType is true', () => {
      const dataNode: DataNode = {
        name: 'phoneNumber',
        type: 'string'
      };

      const steps = generateStepsSkipDetectType(dataNode, true);

      expect(steps).toHaveLength(6);
      expect(steps[0].key).toBe('suggestStructureAndConstraints');
      expect(steps[1].key).toBe('startPrompt');
      expect(steps[2].key).toBe('noMatchPrompts');
      expect(steps[3].key).toBe('noInputPrompts');
      expect(steps[4].key).toBe('confirmationPrompts');
      expect(steps[5].key).toBe('successPrompts');
    });

    it('should include detectType step when skipDetectType is false', () => {
      const dataNode: DataNode = {
        name: 'address',
        type: 'object'
      };

      const steps = generateStepsSkipDetectType(dataNode, false);

      expect(steps).toHaveLength(7);
      expect(steps[0].key).toBe('detectType');
    });

    it('should handle subData steps when skipping detectType', () => {
      const dataNode: DataNode = {
        name: 'birthDate',
        type: 'date',
        subdata: [
          { name: 'day', type: 'number' }
        ]
      };

      const steps = generateStepsSkipDetectType(dataNode, true);

      // 6 base steps (no detectType) + 2 subData steps
      expect(steps).toHaveLength(8);
      expect(steps[0].key).toBe('suggestStructureAndConstraints');
      expect(steps.some(step => step.key === 'subDataMessages_day_0')).toBe(true);
      expect(steps.some(step => step.key === 'subDataScripts_day_0')).toBe(true);
    });
  });

  describe('step execution', () => {
    it('should handle detectType step correctly', async () => {
      const mockResponse = { ai: { type: 'date', icon: 'Calendar' } };
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const dataNode: DataNode = { name: 'birthDate' };
      const steps = generateSteps(dataNode);
      const detectTypeStep = steps[0];

      const result = await detectTypeStep.run();

      expect((global as any).fetch).toHaveBeenCalledWith('/step2-with-provider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify('birthDate')
      });
      expect(result).toEqual({
        stepKey: 'detectType',
        payload: mockResponse.ai
      });
    });

    it('should handle prompt steps correctly', async () => {
      const mockResponse = { ai: ['Can you tell me your birth date?'] };
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const dataNode: DataNode = { name: 'birthDate' };
      const steps = generateSteps(dataNode);
      const startPromptStep = steps[2]; // startPrompt

      const result = await startPromptStep.run();

      expect((global as any).fetch).toHaveBeenCalledWith('/api/startPrompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meaning: 'birthDate', desc: '' })
      });
      expect(result).toEqual({
        stepKey: 'startPrompt',
        payload: mockResponse.ai
      });
    });

    it('should handle subData message steps correctly', async () => {
      const mockResponse = { ai: { start: ['What day were you born?'] } };
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const dataNode: DataNode = {
        name: 'birthDate',
        subdata: [{ name: 'day', type: 'number' }]
      };
      const steps = generateSteps(dataNode);
      const subDataMessageStep = steps.find(step => step.key === 'subDataMessages_day_0');

      expect(subDataMessageStep).toBeDefined();
      const result = await subDataMessageStep!.run();

      expect((global as any).fetch).toHaveBeenCalledWith('/api/generateSubDataMessages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'day',
          label: undefined,
          type: 'number',
          parentField: 'birthDate',
          constraints: []
        })
      });
      expect(result).toEqual({
        stepKey: 'subDataMessages_day_0',
        payload: mockResponse.ai
      });
    });

    it('should handle subData script steps correctly', async () => {
      const mockResponse = { ai: { js: 'function validate(value) { return true; }' } };
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const dataNode: DataNode = {
        name: 'birthDate',
        subdata: [{ name: 'day', type: 'number', constraints: ['range'] }]
      };
      const steps = generateSteps(dataNode);
      const subDataScriptStep = steps.find(step => step.key === 'subDataScripts_day_0');

      expect(subDataScriptStep).toBeDefined();
      const result = await subDataScriptStep!.run();

      expect((global as any).fetch).toHaveBeenCalledWith('/api/generateSubDataScripts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'day',
          constraints: ['range']
        })
      });
      expect(result).toEqual({
        stepKey: 'subDataScripts_day_0',
        payload: mockResponse.ai
      });
    });
  });
});