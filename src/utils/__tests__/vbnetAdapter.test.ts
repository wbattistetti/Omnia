/**
 * Tests for VB.NET Adapter
 * Validates conversion between TypeScript templateId (string) and VB.NET Action (integer)
 */

import { templateIdToVBAction, vbActionToTemplateId, prepareTaskForVBNet } from '../vbnetAdapter';
import type { TaskInstance } from '../../types/taskTypes';

describe('VB.NET Adapter', () => {

  describe('templateIdToVBAction', () => {
    it('should convert SayMessage to 1', () => {
      expect(templateIdToVBAction('SayMessage')).toBe(1);
    });

    it('should convert GetData to 4', () => {
      expect(templateIdToVBAction('GetData')).toBe(4);
    });

    it('should convert ClassifyProblem to 6', () => {
      expect(templateIdToVBAction('ClassifyProblem')).toBe(6);
    });

    it('should convert callBackend to 5', () => {
      expect(templateIdToVBAction('callBackend')).toBe(5);
    });

    it('should convert BackendCall alias to 5', () => {
      expect(templateIdToVBAction('BackendCall')).toBe(5);
    });

    it('should handle case-insensitive input', () => {
      expect(templateIdToVBAction('saymessage')).toBe(1);
      expect(templateIdToVBAction('GETDATA')).toBe(4);
      expect(templateIdToVBAction('  GetData  ')).toBe(4); // Trimmed
    });

    it('should default to SayMessage (1) for unknown templateId', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      expect(templateIdToVBAction('UnknownAction')).toBe(1);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown templateId'),
        'UnknownAction'
      );

      consoleSpy.mockRestore();
    });

    it('should handle empty string by defaulting to SayMessage', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      expect(templateIdToVBAction('')).toBe(1);
      expect(templateIdToVBAction('   ')).toBe(1);

      consoleSpy.mockRestore();
    });
  });

  describe('vbActionToTemplateId', () => {
    it('should convert 1 to SayMessage', () => {
      expect(vbActionToTemplateId(1)).toBe('SayMessage');
    });

    it('should convert 4 to GetData', () => {
      expect(vbActionToTemplateId(4)).toBe('GetData');
    });

    it('should convert 6 to ClassifyProblem', () => {
      expect(vbActionToTemplateId(6)).toBe('ClassifyProblem');
    });

    it('should convert 5 to callBackend', () => {
      expect(vbActionToTemplateId(5)).toBe('callBackend');
    });

    it('should default to SayMessage for unknown action', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      expect(vbActionToTemplateId(999)).toBe('SayMessage');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown action'),
        999
      );

      consoleSpy.mockRestore();
    });
  });

  describe('prepareTaskForVBNet', () => {
    it('should add action (integer) field for VB.NET compatibility', () => {
      const task: TaskInstance = {
        id: 'task_1',
        templateId: 'SayMessage',
        value: { text: 'Hello' }
      };

      const prepared = prepareTaskForVBNet(task);

      expect(prepared.id).toBe('task_1');
      expect(prepared.templateId).toBe('SayMessage');
      expect(prepared.action).toBe(1); // ✅ Integer for VB.NET
      expect(prepared.value).toEqual({ text: 'Hello' });
    });

    it('should convert GetData correctly', () => {
      const task: TaskInstance = {
        id: 'task_2',
        templateId: 'GetData',
        value: { ddt: {} }
      };

      const prepared = prepareTaskForVBNet(task);

      expect(prepared.templateId).toBe('GetData');
      expect(prepared.action).toBe(4);
    });

    it('should convert ClassifyProblem correctly', () => {
      const task: TaskInstance = {
        id: 'task_3',
        templateId: 'ClassifyProblem',
        value: { intents: [] }
      };

      const prepared = prepareTaskForVBNet(task);

      expect(prepared.templateId).toBe('ClassifyProblem');
      expect(prepared.action).toBe(6);
    });
  });

  describe('Round-trip conversion', () => {
    it('should maintain consistency: templateId → action → templateId', () => {
      const templateIds = ['SayMessage', 'GetData', 'ClassifyProblem', 'callBackend'];

      for (const templateId of templateIds) {
        const action = templateIdToVBAction(templateId);
        const backToTemplateId = vbActionToTemplateId(action);
        expect(backToTemplateId).toBe(templateId);
      }
    });

    it('should maintain consistency: action → templateId → action', () => {
      const actions = [1, 2, 3, 4, 5, 6];

      for (const action of actions) {
        const templateId = vbActionToTemplateId(action);
        const backToAction = templateIdToVBAction(templateId);
        expect(backToAction).toBe(action);
      }
    });
  });
});

