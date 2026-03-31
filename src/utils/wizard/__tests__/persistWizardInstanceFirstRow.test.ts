import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { taskRepository } from '@services/TaskRepository';
import { TaskType } from '@types/taskTypes';
import * as featureFlags from '../../../config/featureFlags';
import { persistWizardInstanceFirstRow } from '../persistWizardInstanceFirstRow';

describe('persistWizardInstanceFirstRow', () => {
  beforeEach(() => {
    vi.spyOn(featureFlags, 'isWizardInstanceFirstEnabled').mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes standalone row and clears templateId when flag is on', async () => {
    const tid = 'wizard-if-test-1';
    const guid = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    taskRepository.createTask(
      TaskType.UtteranceInterpretation,
      guid,
      { steps: { [guid]: { start: [] } } },
      tid,
      'proj-1'
    );

    expect(taskRepository.getTask(tid)).not.toBeNull();

    const ok = await persistWizardInstanceFirstRow(tid, 'proj-1', {
      labelKey: 'lbl',
      nodes: [{ id: 'n1', label: 'N', subNodes: [] } as any],
      steps: {},
    });

    expect(ok).toBe(true);
    const t = taskRepository.getTask(tid);
    expect(t?.templateId).toBeNull();
    expect(t?.kind).toBe('standalone');
    expect(t?.subTasks?.length).toBe(1);
  });

  it('returns false when flag is off', async () => {
    vi.spyOn(featureFlags, 'isWizardInstanceFirstEnabled').mockReturnValue(false);

    const tid = 'wizard-if-test-2';
    taskRepository.createTask(TaskType.UtteranceInterpretation, null, {}, tid, 'proj-1');

    const ok = await persistWizardInstanceFirstRow(tid, 'proj-1', {
      labelKey: 'x',
      nodes: [{ id: 'n1' } as any],
      steps: {},
    });

    expect(ok).toBe(false);
  });
});
