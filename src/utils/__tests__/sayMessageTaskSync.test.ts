import { describe, it, expect } from 'vitest';
import { TaskType } from '@types/taskTypes';
import { getSayMessageSyncedBody } from '../sayMessageTaskSync';

describe('sayMessageTaskSync', () => {
  it('ignores task.text when parameters are absent', () => {
    const task = {
      id: 'a',
      type: TaskType.SayMessage,
      templateId: null,
      text: 'should be ignored',
    } as any;
    expect(getSayMessageSyncedBody(task)).toBe('');
  });

  it('returns non-GUID parameter value as literal when translations not available', () => {
    const task = {
      id: 'b',
      type: TaskType.SayMessage,
      templateId: null,
      parameters: [{ parameterId: 'text', value: 'inline literal' }],
    } as any;
    expect(getSayMessageSyncedBody(task)).toBe('inline literal');
  });

  it('returns empty for non-SayMessage tasks', () => {
    const task = { id: 'c', type: TaskType.UtteranceInterpretation, text: 'x' } as any;
    expect(getSayMessageSyncedBody(task)).toBe('');
  });
});
