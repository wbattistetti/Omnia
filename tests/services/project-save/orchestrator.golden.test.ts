// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { describe, it, expect } from 'vitest';
import { ProjectSaveOrchestrator } from '../../../src/services/project-save/ProjectSaveOrchestrator';
import type { ProjectDomainModel } from '../../../src/domain/project/model';
import { TaskType } from '../../../src/types/taskTypes';

describe('ProjectSaveOrchestrator - Golden Master Tests', () => {
  it('should prepare save request from minimal domain model', () => {
    const orchestrator = new ProjectSaveOrchestrator();
    
    const domain: ProjectDomainModel = {
      id: 'test-project',
      name: 'Test Project',
      tasks: [
        { id: 'task-1', type: TaskType.SayMessage, templateId: null },
      ],
      flows: [
        {
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
      ],
      conditions: [],
      templates: [],
      variables: [],
    };

    const uiState = {
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
      allTemplates: [],
    };

    const request = orchestrator.prepareSave(domain, uiState);

    // Structural snapshot (not literal)
    expect(request).toMatchObject({
      version: '1.0',
      projectId: 'test-project',
      catalog: {
        projectId: 'test-project',
      },
      tasks: {
        items: expect.arrayContaining([
          expect.objectContaining({
            id: 'task-1',
            type: TaskType.SayMessage,
          }),
        ]),
        source: 'Project',
      },
      flow: {
        flowId: 'main',
        flow: expect.objectContaining({
          id: 'main',
          title: 'Main Flow',
          nodes: expect.any(Array),
          edges: expect.any(Array),
        }),
      },
      variables: {
        projectId: 'test-project',
        variables: expect.any(Array),
      },
      templates: expect.any(Array),
      conditions: {
        items: expect.any(Array),
      },
    });

    // Verify no orphan tasks in request
    const taskIds = new Set(request.tasks.items.map((t) => t.id));
    const flowTaskIds = new Set<string>();
    request.flow.flow.nodes.forEach((node: any) => {
      node.data?.rows?.forEach((row: any) => {
        if (row.id) flowTaskIds.add(row.id);
      });
    });
    
    const orphanTasks = Array.from(taskIds).filter((id) => !flowTaskIds.has(id));
    expect(orphanTasks).toHaveLength(0);
  });

  it('should validate save request', () => {
    const orchestrator = new ProjectSaveOrchestrator();
    
    const validRequest = {
      version: '1.0' as const,
      projectId: 'test-project',
      catalog: { projectId: 'test-project' },
      tasks: { items: [], source: 'Project' as const },
      flow: { flowId: 'main', flow: { id: 'main', title: 'Main', nodes: [], edges: [] } },
      variables: { projectId: 'test-project', variables: [] },
      templates: [],
      conditions: { items: [] },
    };

    const validation = orchestrator.validateRequest(validRequest);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it('should detect invalid save request', () => {
    const orchestrator = new ProjectSaveOrchestrator();
    
    const invalidRequest = {
      version: '1.0' as const,
      projectId: '', // Invalid: empty projectId
      catalog: { projectId: '' },
      tasks: null as any, // Invalid: missing tasks
      flow: null as any, // Invalid: missing flow
      variables: { projectId: '', variables: [] },
      templates: [],
      conditions: { items: [] },
    };

    const validation = orchestrator.validateRequest(invalidRequest);
    expect(validation.valid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
  });
});
