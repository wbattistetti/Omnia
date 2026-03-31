import { describe, it, expect, beforeEach, vi } from 'vitest';
import { taskRepository } from '@services/TaskRepository';
import { TaskType } from '@types/taskTypes';
import type { Task } from '@types/taskTypes';
import {
  canPromoteStandaloneToProjectTemplateMvp,
  promoteStandaloneToProjectTemplate,
} from '../promoteStandaloneToProjectTemplate';

const GUID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const GUID_CHILD = 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';

describe('canPromoteStandaloneToProjectTemplateMvp', () => {
  it('returns true for single-node standalone with GUID root', () => {
    const task: Task = {
      id: 'row-1',
      type: TaskType.UtteranceInterpretation,
      templateId: null,
      kind: 'standalone',
      subTasks: [{ id: GUID, templateId: GUID, label: 'R', subNodes: [] } as any],
      steps: { [GUID]: {} },
    } as Task;
    expect(canPromoteStandaloneToProjectTemplateMvp(task)).toBe(true);
  });

  it('returns false when more than one main node', () => {
    const task: Task = {
      id: 'row-1',
      type: TaskType.UtteranceInterpretation,
      templateId: null,
      kind: 'standalone',
      subTasks: [
        { id: GUID, templateId: GUID, subNodes: [] } as any,
        { id: GUID + 'b', templateId: GUID + 'b', subNodes: [] } as any,
      ],
      steps: {},
    } as Task;
    expect(canPromoteStandaloneToProjectTemplateMvp(task)).toBe(false);
  });

  it('returns false when a sub-node id is not a GUID', () => {
    const task: Task = {
      id: 'row-1',
      type: TaskType.UtteranceInterpretation,
      templateId: null,
      kind: 'standalone',
      subTasks: [
        {
          id: GUID,
          templateId: GUID,
          subNodes: [{ id: 'child', templateId: 'child', subNodes: [] } as any],
        } as any,
      ],
      steps: {},
    } as Task;
    expect(canPromoteStandaloneToProjectTemplateMvp(task)).toBe(false);
  });

  it('returns true when root has subNodes with GUID ids', () => {
    const task: Task = {
      id: 'row-1',
      type: TaskType.UtteranceInterpretation,
      templateId: null,
      kind: 'standalone',
      subTasks: [
        {
          id: GUID,
          templateId: GUID,
          subNodes: [{ id: GUID_CHILD, templateId: GUID_CHILD, subNodes: [] } as any],
        } as any,
      ],
      steps: { [GUID]: {}, [GUID_CHILD]: {} },
    } as Task;
    expect(canPromoteStandaloneToProjectTemplateMvp(task)).toBe(true);
  });
});

describe('promoteStandaloneToProjectTemplate', () => {
  beforeEach(() => {
    global.fetch = vi.fn(async () => {
      return {
        ok: true,
        json: async () => ({ id: GUID, templateId: null, type: TaskType.UtteranceInterpretation }),
      } as Response;
    }) as typeof fetch;
  });

  it('POSTs template and updates instance row', async () => {
    const tid = 'promote-test-1';
    taskRepository.createTask(
      TaskType.UtteranceInterpretation,
      null,
      {
        kind: 'standalone',
        subTasks: [{ id: GUID, templateId: GUID, label: 'R', subNodes: [] } as any],
        steps: { [GUID]: { start: [] } },
        labelKey: 'lbl',
      },
      tid,
      'proj-x'
    );

    const result = await promoteStandaloneToProjectTemplate(tid, 'proj-x');
    expect(result.rootTemplateId).toBe(GUID);

    const updated = taskRepository.getTask(tid);
    expect(updated?.kind).toBe('instance');
    expect(updated?.templateId).toBe(GUID);
    expect(global.fetch).toHaveBeenCalled();
  });

  it('POSTs child template then root when composite tree', async () => {
    const tid = 'promote-test-2';
    taskRepository.createTask(
      TaskType.UtteranceInterpretation,
      null,
      {
        kind: 'standalone',
        subTasks: [
          {
            id: GUID,
            templateId: GUID,
            label: 'Root',
            subNodes: [{ id: GUID_CHILD, templateId: GUID_CHILD, label: 'C', subNodes: [] } as any],
          } as any,
        ],
        steps: {
          [GUID]: { start: [] },
          [GUID_CHILD]: { start: [] },
        },
        labelKey: 'lbl',
      },
      tid,
      'proj-x'
    );

    await promoteStandaloneToProjectTemplate(tid, 'proj-x');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
