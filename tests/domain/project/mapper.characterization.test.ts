// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { describe, it, expect } from 'vitest';
import { mapUIStateToDomain } from '../../../src/domain/project/mapper';
import type { ProjectDomainModel } from '../../../src/domain/project/model';
import minimalProject from './fixtures/project-minimal.json';

describe('mapUIStateToDomain - Characterization Tests', () => {
  it('should map minimal UI state to domain model', () => {
    const uiState = minimalProject as any;
    const domain = mapUIStateToDomain(uiState);

    // Structural snapshot (not literal)
    expect(domain).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      tasks: expect.any(Array),
      flows: expect.any(Array),
      conditions: expect.any(Array),
      templates: expect.any(Array),
      variables: expect.any(Array),
    });

    // Verify no orphan tasks (invariant)
    const referencedTaskIds = new Set<string>();
    domain.flows.forEach((flow) => {
      flow.nodes.forEach((node) => {
        node.data.rows.forEach((row) => {
          referencedTaskIds.add(row.id);
        });
      });
    });

    const taskIds = new Set(domain.tasks.map((t) => t.id));
    const orphanTasks = Array.from(taskIds).filter((id) => !referencedTaskIds.has(id));
    expect(orphanTasks).toHaveLength(0);
  });

  it('should exclude orphan tasks from domain model', () => {
    const uiState = {
      projectId: 'test-project',
      flows: {
        main: {
          id: 'main',
          title: 'Main Flow',
          nodes: [
            {
              id: 'node-1',
              type: 'default',
              position: { x: 0, y: 0 },
              data: {
                label: 'Node 1',
                rows: [{ id: 'task-1', text: 'Task 1' }],
              },
            },
          ],
          edges: [],
        },
      },
      tasks: [
        { id: 'task-1', type: 0, templateId: null },
        { id: 'task-2', type: 0, templateId: null }, // Orphan
      ],
      conditions: [],
      templates: [],
      variables: [],
    };

    const domain = mapUIStateToDomain(uiState);

    expect(domain.tasks).toHaveLength(1);
    expect(domain.tasks[0].id).toBe('task-1');
    expect(domain.tasks.find((t) => t.id === 'task-2')).toBeUndefined();
  });

  it('includes BackendCall tasks listed in backendCatalogManualEntryIds even when not on a flow node', () => {
    const manualId = 'manual-catalog-backend-id';
    const uiState = {
      projectId: 'test-project',
      flows: {
        main: {
          id: 'main',
          title: 'Main Flow',
          nodes: [],
          edges: [],
        },
      },
      tasks: [
        {
          id: manualId,
          type: 4,
          templateId: null,
          endpoint: { url: 'http://localhost:3110/slots', method: 'GET' },
          mockTable: [{ id: 'row_1', inputs: { n: '1' }, outputs: {} }],
        },
      ],
      backendCatalogManualEntryIds: [manualId],
      conditions: [],
      templates: [],
      variables: [],
    };

    const domain = mapUIStateToDomain(uiState as any);

    expect(domain.tasks).toHaveLength(1);
    expect(domain.tasks[0].id).toBe(manualId);
    expect((domain.tasks[0] as { mockTable?: unknown }).mockTable).toEqual(uiState.tasks[0].mockTable);
  });

  it('should preserve all task fields during mapping', () => {
    const uiState = {
      projectId: 'test-project',
      flows: {
        main: {
          id: 'main',
          title: 'Main Flow',
          nodes: [
            {
              id: 'node-1',
              type: 'default',
              position: { x: 0, y: 0 },
              data: {
                label: 'Node 1',
                rows: [{ id: 'task-1', text: 'Task 1' }],
              },
            },
          ],
          edges: [],
        },
      },
      tasks: [
        {
          id: 'task-1',
          type: 0,
          templateId: 'template-1',
          templateVersion: 1,
          source: 'Factory',
          labelKey: 'test-label',
          steps: { 'template-1': { start: {} } },
          introduction: { text: 'Hello' },
        },
      ],
      conditions: [],
      templates: [],
      variables: [],
    };

    const domain = mapUIStateToDomain(uiState);

    expect(domain.tasks[0]).toMatchObject({
      id: 'task-1',
      type: 0,
      templateId: 'template-1',
      templateVersion: 1,
      source: 'Factory',
      labelKey: 'test-label',
      steps: { 'template-1': { start: {} } },
      introduction: { text: 'Hello' },
    });
  });
});
