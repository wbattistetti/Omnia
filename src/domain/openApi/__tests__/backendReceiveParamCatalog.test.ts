import { describe, expect, it } from 'vitest';
import { TaskType, type Task } from '@types/taskTypes';
import { collectBackendReceiveLeavesFromTask } from '../backendReceiveParamCatalog';

describe('backendReceiveParamCatalog', () => {
  it('walks nested output object and array item properties', () => {
    const task = {
      id: 'bk1',
      type: TaskType.BackendCall,
      outputs: [{ apiField: 'slots[].date', variable: 'd' }],
      backendCallSpecMeta: {
        schemaVersion: 1 as const,
        importState: 'ok' as const,
        lastImportedAt: null,
        contentHash: 'h',
        structuralFingerprint: 'f',
        openapiOutputJsonSchemaByApiName: {
          slots: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                date: { type: 'string', format: 'date' },
                time: { type: 'string', format: 'time' },
              },
            },
          },
        },
      },
    } as Task;

    const leaves = collectBackendReceiveLeavesFromTask(task);
    expect(leaves.some((l) => l.path === 'slots[].date')).toBe(true);
    expect(leaves.some((l) => l.path === 'slots[].time')).toBe(true);
    expect(leaves.find((l) => l.path === 'slots[].date')?.suggestedSlotId).toBe('data');
  });
});
