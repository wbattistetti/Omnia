// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { describe, it, expect } from 'vitest';
import { migrateProject } from '../../src/migrations/migrateProject';
import { detectVersion } from '../../src/migrations/detectVersion';
import { migrate_v1_to_v2 } from '../../src/migrations/migrate_v1_to_v2';

describe('migrateProject - Backward Compatibility Tests', () => {
  it('should detect v1.0 project (has parsers)', () => {
    const v1Project = {
      id: 'test-project',
      name: 'Test Project',
      tasks: [
        {
          id: 'task-1',
          dataContract: {
            parsers: [{ type: 'regex' }], // v1.0: uses parsers
          },
        },
      ],
    };

    const version = detectVersion(v1Project);
    expect(version).toBe('1.0');
  });

  it('should detect v2.0 project (has engines, no parsers)', () => {
    const v2Project = {
      id: 'test-project',
      name: 'Test Project',
      version: '2.0',
      tasks: [
        {
          id: 'task-1',
          dataContract: {
            engines: [{ type: 'regex' }], // v2.0: uses engines
          },
        },
      ],
    };

    const version = detectVersion(v2Project);
    expect(version).toBe('2.0');
  });

  it('should migrate v1.0 project with parsers to engines', () => {
    const v1Project = {
      id: 'test-project',
      name: 'Test Project',
      tasks: [
        {
          id: 'task-1',
          dataContract: {
            parsers: [{ type: 'regex', pattern: 'test' }],
          },
        },
      ],
      templates: [],
      flows: {
        main: {
          id: 'main',
          title: 'Main Flow',
          nodes: [
            {
              id: 'node-1',
              data: {
                rows: [{ id: 'task-1' }],
              },
            },
          ],
          edges: [],
        },
      },
      conditions: [],
      variables: [],
    };

    const migrated = migrate_v1_to_v2(v1Project);

    expect(migrated.version).toBe('2.0');
    expect(migrated.tasks).toBeDefined();
    expect(migrated.tasks.length).toBeGreaterThan(0);
    expect(migrated.tasks[0].dataContract?.engines).toBeDefined();
    expect(migrated.tasks[0].dataContract?.engines[0].type).toBe('regex');
    expect(migrated.tasks[0].dataContract?.parsers).toBeUndefined();
    expect(migrated.success).toBe(true);
  });

  it('should migrate v1.0 project with GrammarFlow to grammarFlow', () => {
    const v1Project = {
      id: 'test-project',
      name: 'Test Project',
      tasks: [
        {
          id: 'task-1',
          dataContract: {
            engines: [
              {
                type: 'grammarflow',
                GrammarFlow: { nodes: [], edges: [] }, // v1.0: PascalCase
              },
            ],
          },
        },
      ],
      templates: [],
      flows: {
        main: {
          id: 'main',
          title: 'Main Flow',
          nodes: [
            {
              id: 'node-1',
              data: {
                rows: [{ id: 'task-1' }],
              },
            },
          ],
          edges: [],
        },
      },
      conditions: [],
      variables: [],
    };

    const migrated = migrate_v1_to_v2(v1Project);

    expect(migrated.tasks).toBeDefined();
    expect(migrated.tasks.length).toBeGreaterThan(0);
    expect(migrated.tasks[0].dataContract?.engines?.[0]?.grammarFlow).toBeDefined();
    expect(migrated.tasks[0].dataContract?.engines?.[0]?.GrammarFlow).toBeUndefined();
    expect(migrated.success).toBe(true);
  });

  it('should remove orphan tasks during migration', () => {
    const v1Project = {
      id: 'test-project',
      name: 'Test Project',
      tasks: [
        { id: 'task-1' },
        { id: 'task-2' }, // Orphan
      ],
      flows: {
        main: {
          id: 'main',
          title: 'Main Flow',
          nodes: [
            {
              id: 'node-1',
              data: {
                rows: [{ id: 'task-1' }], // Only task-1 referenced
              },
            },
          ],
          edges: [],
        },
      },
      templates: [],
      conditions: [],
      variables: [],
    };

    const migrated = migrate_v1_to_v2(v1Project);

    expect(migrated.tasks).toHaveLength(1);
    expect(migrated.tasks[0].id).toBe('task-1');
    expect(migrated.tasks.find((t: any) => t.id === 'task-2')).toBeUndefined();
    expect(migrated.warnings).toContainEqual(
      expect.stringContaining('Removed 1 orphan tasks')
    );
  });

  it('should handle project with no version (assume v1.0)', () => {
    const noVersionProject = {
      id: 'test-project',
      name: 'Test Project',
      tasks: [],
      templates: [],
      flows: {},
      conditions: [],
      variables: [],
    };

    const version = detectVersion(noVersionProject);
    expect(version).toBe('1.0');

    const migrated = migrateProject(noVersionProject);
    expect(migrated.version).toBe('2.0');
    expect(migrated.success).toBe(true);
  });

  it('should not break on empty project', () => {
    const emptyProject = {
      id: 'test-project',
      name: 'Test Project',
    };

    const migrated = migrateProject(emptyProject);
    expect(migrated.version).toBe('2.0');
    expect(migrated.success).toBe(true);
  });

  it('should fix broken conditions (remove missing variable references)', () => {
    const v1Project = {
      id: 'test-project',
      name: 'Test Project',
      tasks: [],
      templates: [],
      flows: {},
      conditions: [
        {
          id: 'condition-1',
          label: 'Test Condition',
          variables: ['var-1', 'var-2'], // var-2 doesn't exist
        },
      ],
      variables: [
        { id: 'var-1', name: 'Variable 1' },
      ],
    };

    const migrated = migrate_v1_to_v2(v1Project);

    expect(migrated.conditions[0].variables).toHaveLength(1);
    expect(migrated.conditions[0].variables[0]).toBe('var-1');
    expect(migrated.warnings).toContainEqual(
      expect.stringContaining('Removed references to missing variables')
    );
  });
});
