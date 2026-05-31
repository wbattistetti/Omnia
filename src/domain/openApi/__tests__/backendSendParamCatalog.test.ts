import { describe, expect, it } from 'vitest';
import { TaskType, type Task } from '@types/taskTypes';
import { collectBackendSendLeavesFromTask } from '../backendSendParamCatalog';

describe('collectBackendSendLeavesFromTask', () => {
  it('espande queryConstraints.horizon leaf', () => {
    const task = {
      id: 'bk1',
      type: TaskType.BackendCall,
      inputs: [{ apiParam: 'queryConstraints', variable: 'qc' }],
      backendCallSpecMeta: {
        schemaVersion: 1 as const,
        importState: 'ok' as const,
        lastImportedAt: null,
        contentHash: 'h',
        structuralFingerprint: 'f',
        openapiInputJsonSchemaByApiName: {
          queryConstraints: {
            type: 'object',
            properties: {
              horizon: {
                type: 'object',
                properties: {
                  start: { type: 'string', format: 'date', description: 'Inizio' },
                  end: { type: 'string', format: 'date', description: 'Fine' },
                },
              },
            },
          },
        },
      },
    } as Task;

    const leaves = collectBackendSendLeavesFromTask(task);
    expect(leaves.some((l) => l.path === 'queryConstraints.horizon.end')).toBe(true);
    expect(leaves.find((l) => l.path === 'queryConstraints.horizon.end')?.description).toBe('Fine');
  });
});
