import { describe, it, expect } from 'vitest';
import type { Task } from '@types/taskTypes';
import { TaskType } from '@types/taskTypes';
import {
  collectTaskIdsInSubTasksTree,
  rootSubTasksTreeContainsTaskId,
  resolveTaskInEditorScope,
  resolveTemplateDefinitionTask,
} from '../taskScopedLookup';

function makeTask(id: string, subTasks?: Task['subTasks']): Task {
  return {
    id,
    type: TaskType.UtteranceInterpretation,
    templateId: null,
    subTasks,
  } as Task;
}

describe('taskScopedLookup', () => {
  it('resolveTaskInEditorScope returns root when nodeTaskId matches root', () => {
    const root = makeTask('root-1');
    const store = new Map<string, Task>([['root-1', root]]);
    const r = resolveTaskInEditorScope('root-1', null, (id) => store.get(id) ?? null);
    expect(r?.id).toBe('root-1');
  });

  it('resolveTaskInEditorScope returns subtask when id is in subTasks tree', () => {
    const sub = makeTask('sub-1');
    const root = makeTask('root-1', [
      { id: 'n1', templateId: 'x', label: 'L', subNodes: [], taskId: 'sub-1' } as any,
    ]);
    const store = new Map<string, Task>([
      ['root-1', root],
      ['sub-1', sub],
    ]);
    const r = resolveTaskInEditorScope('root-1', 'sub-1', (id) => store.get(id) ?? null);
    expect(r?.id).toBe('sub-1');
  });

  it('rootSubTasksTreeContainsTaskId is true for nested task id', () => {
    const root = makeTask('root-1', [
      {
        id: 'n1',
        templateId: 't1',
        label: 'A',
        subNodes: [{ id: 'n2', templateId: 't2', label: 'B', subNodes: [], taskId: 'leaf-1' } as any],
        taskId: 'mid-1',
      } as any,
    ]);
    expect(rootSubTasksTreeContainsTaskId(root, 'leaf-1')).toBe(true);
  });

  it('collectTaskIdsInSubTasksTree gathers ids from taskId or id', () => {
    const ids = collectTaskIdsInSubTasksTree([
      { id: 'a', templateId: 'a', label: 'x', taskId: 'task-a', subNodes: [] } as any,
    ]);
    expect(ids).toContain('task-a');
  });

  it('resolveTemplateDefinitionTask loads by id', () => {
    const tpl = makeTask('tpl-1');
    const store = new Map<string, Task>([['tpl-1', tpl]]);
    expect(resolveTemplateDefinitionTask('tpl-1', (id) => store.get(id) ?? null)?.id).toBe('tpl-1');
    expect(resolveTemplateDefinitionTask(null, (id) => store.get(id) ?? null)).toBeNull();
  });
});
