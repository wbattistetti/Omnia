import { describe, it, expect, beforeEach } from 'vitest';
import { taskRepository } from '@services/TaskRepository';
import { TaskType } from '@types/taskTypes';
import type { NodeRowData } from '@types/project';
import {
  applySemanticValuesDraftToRow,
  getSemanticValuesForRow,
  pruneSemanticDraftFromRow,
  flushSemanticDraftToTaskOnTaskCreated,
  reconcileRowMetaWithExistingTask,
} from '../semanticValuesRowState';

const TID = 'sv_row_test_a';

describe('semanticValuesRowState', () => {
  beforeEach(async () => {
    await taskRepository.deleteTask(TID);
  });

  it('pre-task: reads draft from row.meta', () => {
    const row: NodeRowData = {
      id: 'row-a',
      text: 't',
      meta: { semanticValuesDraft: [{ id: 'v1', label: 'One' }] },
    };
    const s = getSemanticValuesForRow(row);
    expect(s.isOpenDomain).toBe(false);
    expect(s.items).toHaveLength(1);
  });

  it('post-task: task.semanticValues wins over row draft', () => {
    taskRepository.createTask(TaskType.UtteranceInterpretation, null, {}, TID, 'proj-test');
    taskRepository.updateTask(TID, {
      semanticValues: [{ id: 't1', label: 'FromTask' }],
    });
    const row: NodeRowData = {
      id: TID,
      text: 't',
      meta: { semanticValuesDraft: [{ id: 'd1', label: 'Draft' }] },
    };
    const s = getSemanticValuesForRow(row);
    expect(s.items[0]?.label).toBe('FromTask');
  });

  it('pruneSemanticDraftFromRow removes meta when empty', () => {
    const row: NodeRowData = {
      id: TID,
      text: 't',
      meta: { semanticValuesDraft: [] },
    };
    const next = pruneSemanticDraftFromRow(row);
    expect(next.meta).toBeUndefined();
  });

  it('flushSemanticDraftToTaskOnTaskCreated copies draft and clears row', () => {
    taskRepository.createTask(TaskType.UtteranceInterpretation, null, {}, TID, 'proj-test');
    const row: NodeRowData = {
      id: TID,
      text: 't',
      meta: { semanticValuesDraft: [{ id: 'x', label: 'Y' }] },
    };
    const next = flushSemanticDraftToTaskOnTaskCreated(row, TID);
    expect(next).not.toBeNull();
    expect(next!.meta).toBeUndefined();
    const t = taskRepository.getTask(TID);
    expect(t?.semanticValues?.[0]?.label).toBe('Y');
  });

  it('reconcileRowMetaWithExistingTask drops stale draft when task exists', () => {
    taskRepository.createTask(TaskType.UtteranceInterpretation, null, {}, TID, 'proj-test');
    const row: NodeRowData = {
      id: TID,
      text: 't',
      meta: { semanticValuesDraft: [{ id: 'd', label: 'stale' }] },
    };
    const next = reconcileRowMetaWithExistingTask(row);
    expect(next?.meta).toBeUndefined();
  });

  it('applySemanticValuesDraftToRow sets null for open domain', () => {
    const row: NodeRowData = { id: TID, text: 't' };
    const next = applySemanticValuesDraftToRow(row, null);
    expect(next.meta?.semanticValuesDraft).toBeNull();
  });
});
