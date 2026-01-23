import { describe, it, expect } from 'vitest';
import { buildSteps, buildStepsWithSubData, StepResults } from '../buildStepMessagesFromResults';

describe('buildStepMessagesFromResults', () => {
  describe('buildSteps (legacy)', () => {
    it('should build data stepMessages correctly', () => {
      const stepResults: StepResults = [
        {
          stepKey: 'startPrompt',
          payload: { ai: ['What is your birth date?'] }
        },
        {
          stepKey: 'noMatchPrompts',
          payload: { ai: ['Sorry, I did not understand. Please try again.'] }
        }
      ];

      const result = buildSteps(stepResults);

      expect(result.start).toEqual([['What is your birth date?']]);
      expect(result.noMatch).toEqual([['Sorry, I did not understand. Please try again.']]);
    });

    it('should handle empty stepResults', () => {
      const stepResults: StepResults = [];

      const result = buildSteps(stepResults);

      expect(result).toEqual({});
    });
  });

  describe('buildStepsWithSubData (new)', () => {
    it('should build data and subData stepMessages correctly', () => {
      const stepResults: StepResults = [
        {
          stepKey: 'startPrompt',
          payload: { ai: ['What is your birth date?'] }
        },
        {
          stepKey: 'subDataMessages_day_0',
          payload: { 
            ai: {
              start: ['What day were you born?'],
              noMatch: ['That is not a valid day. Please try again.']
            }
          }
        },
        {
          stepKey: 'subDataMessages_month_0',
          payload: { 
            ai: {
              start: ['What month were you born?'],
              noMatch: ['That is not a valid month. Please try again.']
            }
          }
        }
      ];

      const result = buildStepsWithSubData(stepResults);

      // Check data
      expect(result.data.start).toEqual([['What is your birth date?']]);
      expect(result.data.noMatch).toBeUndefined();

      // Check subData
      expect(result.subData.day.start).toEqual([['What day were you born?']]);
      expect(result.subData.day.noMatch).toEqual([['That is not a valid day. Please try again.']]);
      expect(result.subData.month.start).toEqual([['What month were you born?']]);
      expect(result.subData.month.noMatch).toEqual([['That is not a valid month. Please try again.']]);
    });

    it('should handle subData scripts correctly', () => {
      const stepResults: StepResults = [
        {
          stepKey: 'subDataScripts_day_0',
          payload: { 
            ai: {
              js: 'function validate(value) { return value >= 1 && value <= 31; }',
              py: 'def validate(value): return 1 <= value <= 31',
              ts: 'function validate(value: number): boolean { return value >= 1 && value <= 31; }'
            }
          }
        }
      ];

      const result = buildStepsWithSubData(stepResults);

      expect(result.data).toEqual({});
      expect(result.subData.day.scripts).toEqual([
        [JSON.stringify({
          ai: {
            js: 'function validate(value) { return value >= 1 && value <= 31; }',
            py: 'def validate(value): return 1 <= value <= 31',
            ts: 'function validate(value: number): boolean { return value >= 1 && value <= 31; }'
          }
        })]
      ]);
    });

    it('should handle mixed data and subData steps', () => {
      const stepResults: StepResults = [
        {
          stepKey: 'startPrompt',
          payload: { ai: ['What is your birth date?'] }
        },
        {
          stepKey: 'subDataMessages_day_0',
          payload: { 
            ai: {
              start: ['What day were you born?']
            }
          }
        },
        {
          stepKey: 'noMatchPrompts',
          payload: { ai: ['Sorry, I did not understand.'] }
        }
      ];

      const result = buildStepsWithSubData(stepResults);

      // Check data
      expect(result.data.start).toEqual([['What is your birth date?']]);
      expect(result.data.noMatch).toEqual([['Sorry, I did not understand.']]);

      // Check subData
      expect(result.subData.day.start).toEqual([['What day were you born?']]);
    });

    it('should handle invalid subData step keys gracefully', () => {
      const stepResults: StepResults = [
        {
          stepKey: 'subDataMessages_invalid',
          payload: { ai: { start: ['Test message'] } }
        }
      ];

      const result = buildStepsWithSubData(stepResults);

      expect(result.data).toEqual({});
      expect(result.subData).toEqual({});
    });

    it('should handle empty stepResults', () => {
      const stepResults: StepResults = [];

      const result = buildStepsWithSubData(stepResults);

      expect(result.data).toEqual({});
      expect(result.subData).toEqual({});
    });
  });
}); 