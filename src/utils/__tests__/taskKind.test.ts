import { describe, it, expect } from 'vitest';
import type { Task } from '@types/taskTypes';
import { TaskType, TemplateSource } from '@types/taskTypes';
import {
  inferTaskKind,
  isStandalone,
  hasLocalSchema,
  isStandaloneMaterializedTaskRow,
  taskKindLabel,
  taskRowUsesSubTasksContract,
} from '../taskKind';

function baseTask(over: Partial<Task>): Task {
  return {
    id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    type: TaskType.UtteranceInterpretation,
    templateId: null,
    ...over,
  } as Task;
}

describe('inferTaskKind', () => {
  it('returns instance when templateId is a GUID', () => {
    const t = baseTask({
      templateId: '11111111-2222-3333-4444-555555555555',
    });
    expect(inferTaskKind(t)).toBe('instance');
  });

  it('returns explicit kind when set', () => {
    const t = baseTask({ kind: 'standalone', templateId: null });
    expect(inferTaskKind(t)).toBe('standalone');
  });

  it('returns factoryTemplate when source is Factory and no instance templateId', () => {
    const t = baseTask({ templateId: null, source: TemplateSource.Factory });
    expect(inferTaskKind(t)).toBe('factoryTemplate');
  });

  it('returns projectTemplate when templateId null and subTasksIds present', () => {
    const t = baseTask({
      templateId: null,
      subTasksIds: ['aaaaaaaa-bbbb-cccc-dddd-111111111111'],
    });
    expect(inferTaskKind(t)).toBe('projectTemplate');
  });

  it('returns standalone when subTasks present without explicit kind', () => {
    const t = baseTask({
      templateId: null,
      subTasks: [
        {
          id: 'node-1',
          templateId: 'node-1',
          label: 'Root',
        },
      ],
    });
    expect(inferTaskKind(t)).toBe('standalone');
  });

  it('returns projectTemplate for legacy template row without subTasksIds or subTasks', () => {
    const t = baseTask({ templateId: null });
    expect(inferTaskKind(t)).toBe('projectTemplate');
  });
});

describe('isStandaloneMaterializedTaskRow', () => {
  it('is true only when kind is standalone', () => {
    expect(isStandaloneMaterializedTaskRow(baseTask({ kind: 'standalone' }))).toBe(true);
    expect(
      isStandaloneMaterializedTaskRow(
        baseTask({ templateId: '11111111-2222-3333-4444-555555555555' })
      )
    ).toBe(false);
    expect(isStandaloneMaterializedTaskRow(null)).toBe(false);
  });
});

describe('taskRowUsesSubTasksContract', () => {
  it('is true when kind is standalone', () => {
    expect(taskRowUsesSubTasksContract(baseTask({ kind: 'standalone' }))).toBe(true);
  });

  it('is true when templateId is null even if kind not yet persisted (new row)', () => {
    expect(taskRowUsesSubTasksContract(baseTask({ templateId: null }))).toBe(true);
  });

  it('is false when task references a catalogue template GUID', () => {
    expect(
      taskRowUsesSubTasksContract(
        baseTask({ templateId: '11111111-2222-3333-4444-555555555555' })
      )
    ).toBe(false);
  });

  it('is false for null task', () => {
    expect(taskRowUsesSubTasksContract(null)).toBe(false);
  });
});

describe('isStandalone / hasLocalSchema', () => {
  it('isStandalone true when kind standalone', () => {
    expect(isStandalone(baseTask({ kind: 'standalone' }))).toBe(true);
  });

  it('hasLocalSchema when subTasks non-empty', () => {
    expect(
      hasLocalSchema(
        baseTask({
          subTasks: [{ id: 'a', templateId: 'a', label: 'L' }],
        })
      )
    ).toBe(true);
  });
});

describe('taskKindLabel', () => {
  it('returns labels for all kinds', () => {
    expect(taskKindLabel('standalone')).toBe('Standalone');
    expect(taskKindLabel('instance')).toBe('Instance');
    expect(taskKindLabel('projectTemplate')).toBe('Project template');
    expect(taskKindLabel('factoryTemplate')).toBe('Factory template');
  });
});
