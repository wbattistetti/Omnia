// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { describe, it, expect } from 'vitest';
import { validateProjectDomain } from '../../../src/domain/project/validator';
import type { ProjectDomainModel } from '../../../src/domain/project/model';
import { TaskType } from '../../../src/types/taskTypes';

describe('validateProjectDomain', () => {
  it('should validate a valid project domain', () => {
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

    const result = validateProjectDomain(domain);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should detect orphan tasks', () => {
    const domain: ProjectDomainModel = {
      id: 'test-project',
      name: 'Test Project',
      tasks: [
        { id: 'task-1', type: TaskType.SayMessage, templateId: null },
        { id: 'task-2', type: TaskType.SayMessage, templateId: null }, // Orphan
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
                rows: [{ id: 'task-1', text: 'Task 1' }], // Only task-1 referenced
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

    const result = validateProjectDomain(domain);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: 'ORPHAN_TASKS',
      })
    );
  });

  it('should detect conditions with missing variables', () => {
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
      conditions: [
        {
          id: 'condition-1',
          label: 'Test Condition',
          script: 'var1 > 10',
          variables: ['var-1', 'var-2'], // var-2 doesn't exist
        },
      ],
      templates: [],
      variables: [
        { id: 'var-1', name: 'Variable 1', type: 'number' },
      ],
    };

    const result = validateProjectDomain(domain);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: 'MISSING_VARIABLES',
      })
    );
  });

  it('should detect flow edges pointing to non-existent nodes', () => {
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
          edges: [
            {
              id: 'edge-1',
              source: 'node-1',
              target: 'node-2', // Non-existent node
            },
          ],
        },
      ],
      conditions: [],
      templates: [],
      variables: [],
    };

    const result = validateProjectDomain(domain);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: 'EDGE_INVALID_TARGET',
      })
    );
  });
});
