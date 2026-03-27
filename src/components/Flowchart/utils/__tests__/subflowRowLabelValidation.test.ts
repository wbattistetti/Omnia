import { describe, expect, it, vi, beforeEach } from 'vitest';
import { TaskType } from '../../../../types/taskTypes';
import { findDuplicateNormalizedSubflowRowLabel } from '../subflowRowLabelValidation';

vi.mock('../../../../services/TaskRepository', () => ({
  taskRepository: {
    getTask: vi.fn(),
  },
}));

import { taskRepository } from '../../../../services/TaskRepository';

describe('findDuplicateNormalizedSubflowRowLabel', () => {
  beforeEach(() => {
    vi.mocked(taskRepository.getTask).mockReset();
  });

  it('returns null when no other Subflow row shares the normalized label', () => {
    vi.mocked(taskRepository.getTask).mockImplementation((id: string) => {
      if (id === 'r1') return { type: TaskType.Subflow, name: 'Alpha' } as any;
      if (id === 'r2') return { type: TaskType.Subflow, name: 'Beta' } as any;
      return null;
    });
    const flows = {
      flow1: {
        nodes: [{ data: { rows: [{ id: 'r1', text: 'Alpha' }] } }, { data: { rows: [{ id: 'r2', text: 'Beta' }] } }],
      },
    };
    expect(findDuplicateNormalizedSubflowRowLabel('flow1', flows, 'r1', 'Alpha')).toBeNull();
  });

  it('detects another Subflow row with the same normalized label', () => {
    vi.mocked(taskRepository.getTask).mockImplementation((id: string) => {
      if (id === 'r1' || id === 'r2') return { type: TaskType.Subflow, name: 'Same' } as any;
      return null;
    });
    const flows = {
      flow1: {
        nodes: [{ data: { rows: [{ id: 'r1', text: 'Chiedi la stessa cosa' }, { id: 'r2', text: 'Chiedi la stessa cosa' }] } }],
      },
    };
    const dup = findDuplicateNormalizedSubflowRowLabel('flow1', flows, 'r1', 'Chiedi la stessa cosa');
    expect(dup).not.toBeNull();
    expect(dup?.duplicateRowTaskId).toBe('r2');
  });
});
