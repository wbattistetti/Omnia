/**
 * Tests for ensureTaskExists: repository hydration before materialization.
 */

import { describe, expect, it } from 'vitest';
import { TaskType } from '@types/taskTypes';
import { ensureTaskExists } from '../ensureTaskExists';

describe('ensureTaskExists', () => {
  it('creates standalone shell when missing', () => {
    const id = crypto.randomUUID();
    const t = ensureTaskExists(id, { taskType: TaskType.UtteranceInterpretation });
    expect(t.id).toBe(id);
    expect(t.templateId).toBeNull();
    expect(t.kind).toBe('standalone');
    expect(t.steps).toEqual({});
    expect(t.subTasks).toEqual([]);
  });

  it('returns existing task without duplicating', () => {
    const id = crypto.randomUUID();
    const a = ensureTaskExists(id, { taskType: TaskType.UtteranceInterpretation });
    const b = ensureTaskExists(id, { taskType: TaskType.UtteranceInterpretation });
    expect(a.id).toBe(b.id);
  });
});
