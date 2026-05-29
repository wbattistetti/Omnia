import { describe, expect, it } from 'vitest';
import { TaskType, type Task } from '@types/taskTypes';
import { buildOpenApiParamContractLines, OPENAPI_CONTRACT_MISSING_PREFIX } from '../buildOpenApiParamContractLines';

describe('buildOpenApiParamContractLines', () => {
  it('espande proprietà sotto constraints', () => {
    const task = {
      id: 'bk1',
      type: TaskType.BackendCall,
      inputs: [
        { apiParam: 'constraints', variable: 'c' },
        { apiParam: 'windowDays', variable: 'w' },
      ],
      outputs: [{ apiField: 'done', variable: 'd' }],
      backendCallSpecMeta: {
        schemaVersion: 1 as const,
        importState: 'ok' as const,
        lastImportedAt: null,
        contentHash: 'h',
        structuralFingerprint: 'f',
        openapiInputJsonSchemaByApiName: {
          constraints: {
            type: 'object',
            properties: {
              weekdays: {
                type: 'array',
                items: { type: 'integer', minimum: 0, maximum: 6 },
              },
              label: { type: 'string' },
            },
          },
          windowDays: { type: 'integer', minimum: 1, maximum: 30 },
        },
        openapiOutputJsonSchemaByApiName: {
          done: { type: 'boolean' },
        },
      },
    } as Task;

    const lines = buildOpenApiParamContractLines(task);
    const constraints = lines.find((l) => l.paramKey === 'constraints');
    expect(constraints?.contractText).toBe('type object');
    expect(constraints?.nestedLines.some((n) => n.path === 'constraints.weekdays')).toBe(true);
    expect(constraints?.nestedLines.some((n) => n.path === 'constraints.label' && n.missing)).toBe(
      true
    );

    const done = lines.find((l) => l.paramKey === 'done');
    expect(done?.contractText).toContain('type boolean');
    expect(done?.missing).toBe(false);
  });

  it('RECEIVE senza schema output → MISSING', () => {
    const task = {
      id: 'bk1',
      type: TaskType.BackendCall,
      outputs: [{ apiField: 'slots', variable: 's' }],
      backendCallSpecMeta: {
        schemaVersion: 1 as const,
        importState: 'ok' as const,
        lastImportedAt: null,
        contentHash: 'h',
        structuralFingerprint: 'f',
      },
    } as Task;
    const lines = buildOpenApiParamContractLines(task);
    const slots = lines.find((l) => l.paramKey === 'slots');
    expect(slots?.contractText).toContain(OPENAPI_CONTRACT_MISSING_PREFIX);
  });
});
