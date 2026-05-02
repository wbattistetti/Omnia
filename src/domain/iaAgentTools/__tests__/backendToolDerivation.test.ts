import { describe, expect, it } from 'vitest';
import { TaskType, type Task } from '@types/taskTypes';
import type { IAAgentConfig } from 'types/iaAgentRuntimeSetup';
import {
  buildToolInputSchemaFromBackendInputs,
  dedupeToolDefinitionNames,
  deriveBackendToolDefinition,
  deriveExportedToolName,
  lastUrlPathSegment,
  mergeEffectiveIaAgentTools,
  sanitizeConvaiToolName,
} from '../backendToolDerivation';

function backendTask(partial: Partial<Task> & { id: string }): Task {
  return {
    type: TaskType.BackendCall,
    templateId: null,
    ...partial,
  } as Task;
}

describe('backendToolDerivation', () => {
  it('sanitizeConvaiToolName normalizes to ascii identifier', () => {
    expect(sanitizeConvaiToolName('  get-patient!  ')).toBe('get_patient');
    expect(sanitizeConvaiToolName('123x')).toBe('t_123x');
  });

  it('lastUrlPathSegment returns last path segment', () => {
    expect(lastUrlPathSegment('https://api.example.com/v1/patients/search')).toBe('search');
  });

  it('deriveExportedToolName prefers label then operationId in meta', () => {
    const withLabel = backendTask({
      id: 'a',
      label: 'Il mio tool',
      endpoint: { url: 'https://x.test/a/b', method: 'POST', headers: {} },
      inputs: [],
      outputs: [],
    });
    expect(deriveExportedToolName(withLabel)).toBe('Il_mio_tool');

    const withOp = backendTask({
      id: 'b',
      label: '',
      backendCallSpecMeta: {
        schemaVersion: 1,
        lastImportedAt: null,
        contentHash: null,
        importState: 'none',
        structuralFingerprint: null,
        openapiOperationId: 'findPatient',
      },
      endpoint: { url: 'https://x.test/a/b', method: 'POST', headers: {} },
      inputs: [],
      outputs: [],
    });
    expect(deriveExportedToolName(withOp)).toBe('findPatient');
  });

  it('deriveBackendToolDefinition requires label and backendToolDescription', () => {
    const ok = backendTask({
      id: 'c',
      label: 'catalogo',
      backendToolDescription: 'Cerca nel catalogo prodotti.',
      endpoint: { url: 'https://api.example.com/items', method: 'GET', headers: {} },
      inputs: [{ internalName: 'q', apiParam: 'query', variable: '' }],
      outputs: [],
    });
    const r = deriveBackendToolDefinition(ok);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.tool.name).toBe('catalogo');
      expect(r.tool.description).toContain('catalogo');
      expect(r.tool.inputSchema.type).toBe('object');
      expect((r.tool.inputSchema.properties as Record<string, unknown>).query).toBeDefined();
    }

    const noDesc = backendTask({
      id: 'd',
      label: 'x',
      endpoint: { url: 'https://a', method: 'GET', headers: {} },
      inputs: [],
      outputs: [],
    });
    expect(deriveBackendToolDefinition(noDesc).ok).toBe(false);
  });

  it('dedupeToolDefinitionNames resolves collisions', () => {
    const out = dedupeToolDefinitionNames([
      { name: 'same', description: 'a', inputSchema: { type: 'object', properties: {} } },
      { name: 'same', description: 'b', inputSchema: { type: 'object', properties: {} } },
    ]);
    expect(out[0].name).toBe('same');
    expect(out[1].name).not.toBe('same');
  });

  it('mergeEffectiveIaAgentTools merges manual and backend-derived', () => {
    const cfg: IAAgentConfig = {
      platform: 'elevenlabs',
      model: 'convai_default',
      temperature: 0.5,
      maxTokens: 100,
      reasoning: 'none',
      systemPrompt: '',
      tools: [{ name: 'manual_one', description: 'Manuale.', inputSchema: { type: 'object', properties: {} } }],
      convaiBackendToolTaskIds: ['bk1'],
    };

    const merged = mergeEffectiveIaAgentTools(cfg, (id) =>
      id === 'bk1'
        ? backendTask({
            id: 'bk1',
            label: 'bk_tool',
            backendToolDescription: 'Da backend.',
            endpoint: { url: 'https://z/', method: 'GET', headers: {} },
            inputs: [],
            outputs: [],
          })
        : null
    );

    expect(merged.map((t) => t.name).sort()).toEqual(['bk_tool', 'manual_one']);
  });
});
