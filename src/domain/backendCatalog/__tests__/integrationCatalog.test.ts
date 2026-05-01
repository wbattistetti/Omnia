import { describe, it, expect } from 'vitest';
import { TaskType, type Task } from '../../../types/taskTypes';
import { buildProjectBackendCatalogView } from '../buildProjectCatalogView';

describe('buildProjectBackendCatalogView integration', () => {
  it('combines BackendCall task + manual entry', () => {
    const tasks: Task[] = [
      {
        id: 'bc1',
        type: TaskType.BackendCall,
        templateId: null,
        endpoint: { url: 'http://localhost:3110/slots', method: 'GET' },
        backendCallSpecMeta: {
          schemaVersion: 1,
          lastImportedAt: '2026-01-01',
          contentHash: 'abc',
          importState: 'ok',
          structuralFingerprint: 'GET|http://localhost:3110/slots',
        },
      } as Task,
    ];
    const manual = [
      {
        id: 'm1',
        label: 'Doc',
        endpointUrl: 'http://other/openapi.json',
        method: 'GET',
        frozenMeta: {
          lastImportedAt: null,
          specSourceUrl: null,
          contentHash: null,
          importState: 'none' as const,
        },
        lastStructuralEditAt: '2026-01-02',
      },
    ];
    const { rows } = buildProjectBackendCatalogView(tasks, manual);
    expect(rows.length).toBeGreaterThanOrEqual(2);
  });
});
