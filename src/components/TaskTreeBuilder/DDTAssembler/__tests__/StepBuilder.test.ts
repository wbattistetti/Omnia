import { buildActionInstance, buildEscalation, buildStepGroup } from '../StepBuilder';
import { v4 as uuidv4 } from 'uuid';

jest.mock('uuid', () => ({ v4: () => 'mock-uuid' }));

describe('StepBuilder', () => {
  const ddtId = 'ddt_test';

  describe('buildActionInstance', () => {
    it('should create a valid Action and translation for start step', () => {
      const task = buildActionInstance('start', 'Hello!', ddtId, {});
      expect(task.type).toBe(3); // TaskType.UtteranceInterpretation
      expect(task.params?.text).toContain('runtime.ddt_test.start.DataRequest');
    });
    it('should create a valid Action and translation for noMatch step', () => {
      const { action, translation } = buildActionInstance('noMatch', 'No match!', ddtId, 1, 2);
      expect(action.actionId).toBe('sayMessage');
      expect(action.parameters[0].value).toContain('runtime.ddt_test.noMatch#2.sayMessage_2_3_mock-uuid.text');
      expect(translation.value).toBe('No match!');
    });
  });

  describe('buildEscalation', () => {
    it('should create an Escalation with correct actions and translations', () => {
      const { escalation, translations } = buildEscalation('start', ['A', 'B'], ddtId, 0);
      expect(escalation.actions.length).toBe(2);
      expect(translations.length).toBe(2);
      expect(translations[0].value).toBe('A');
      expect(translations[1].value).toBe('B');
    });
  });

  describe('buildStepGroup', () => {
    it('should create a StepGroup with correct escalations and translations', () => {
      const messagesArr = [['A1', 'A2'], ['B1']];
      const { step, translations } = buildStepGroup('start', messagesArr, ddtId);
      expect(step.type).toBe('start');
      expect(step.escalations.length).toBe(2);
      expect(step.escalations[0].actions.length).toBe(2);
      expect(step.escalations[1].actions.length).toBe(1);
      expect(translations.length).toBe(3);
      expect(translations.map(t => t.value)).toEqual(['A1', 'A2', 'B1']);
    });
  });
});