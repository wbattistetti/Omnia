/**
 * GUID set for utterance variable menu: flow rows → taskRepository trees → TaskTreeNode.id.
 */
import { describe, expect, it } from 'vitest';
import { collectUtteranceNodeGuidSetForFlow } from '../variableMenuModel';
import { taskRepository } from '../../../services/TaskRepository';
import { TaskType } from '../../../types/taskTypes';

describe('collectUtteranceNodeGuidSetForFlow', () => {
  async function cleanup(id: string) {
    await taskRepository.deleteTask(id);
  }

  it('collects all TaskTreeNode ids from utterance tasks on included flow rows', async () => {
    const tid = `vitest-utter-guids-${Math.random().toString(36).slice(2, 10)}`;
    const nodeA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const nodeB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    taskRepository.createTask(
      TaskType.UtteranceInterpretation,
      'tpl-x',
      {
        subTasks: [
          {
            id: nodeA,
            label: 'root',
            templateId: 't',
            subNodes: [{ id: nodeB, label: 'child', templateId: 't' }],
          },
        ],
      },
      tid,
      undefined
    );
    try {
      const flows = {
        main: {
          id: 'main',
          title: 'Main',
          nodes: [
            {
              id: 'n1',
              data: {
                rows: [{ id: tid, text: 'Ask', included: true }],
              },
            },
          ],
          edges: [],
        },
      } as const;
      const set = collectUtteranceNodeGuidSetForFlow('main', flows as any);
      expect(set.has(nodeA)).toBe(true);
      expect(set.has(nodeB)).toBe(true);
    } finally {
      await cleanup(tid);
    }
  });

  it('skips flow rows with included === false', async () => {
    const tid = `vitest-utter-skip-${Math.random().toString(36).slice(2, 10)}`;
    const nodeA = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
    taskRepository.createTask(
      TaskType.UtteranceInterpretation,
      'tpl-y',
      {
        subTasks: [{ id: nodeA, label: 'root', templateId: 't' }],
      },
      tid,
      undefined
    );
    try {
      const flows = {
        main: {
          id: 'main',
          title: 'Main',
          nodes: [
            {
              id: 'n1',
              data: {
                rows: [{ id: tid, text: 'Ask', included: false }],
              },
            },
          ],
          edges: [],
        },
      } as const;
      const set = collectUtteranceNodeGuidSetForFlow('main', flows as any);
      expect(set.has(nodeA)).toBe(false);
    } finally {
      await cleanup(tid);
    }
  });

  it('includes ClassifyProblem tasks with the same tree walk', async () => {
    const tid = `vitest-classify-guids-${Math.random().toString(36).slice(2, 10)}`;
    const nodeId = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
    taskRepository.createTask(
      TaskType.ClassifyProblem,
      'tpl-z',
      {
        subTasks: [{ id: nodeId, label: 'slot', templateId: 't' }],
      },
      tid,
      undefined
    );
    try {
      const flows = {
        main: {
          id: 'main',
          title: 'Main',
          nodes: [
            {
              id: 'n1',
              data: {
                rows: [{ id: tid, text: 'Classify', included: true }],
              },
            },
          ],
          edges: [],
        },
      } as const;
      const set = collectUtteranceNodeGuidSetForFlow('main', flows as any);
      expect(set.has(nodeId)).toBe(true);
    } finally {
      await cleanup(tid);
    }
  });
});
