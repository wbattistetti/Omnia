import { describe, expect, it } from 'vitest';
import { TaskType, type Task } from '@types/taskTypes';
import type { IAAgentConfig } from 'types/iaAgentRuntimeSetup';
import {
  buildToolInputSchemaFromBackendInputs,
  dedupeToolDefinitionNames,
  deriveBackendToolDefinition,
  deriveExportedToolName,
  lastUrlPathSegment,
  mergeBookFromAgendaScopeIntoInputSchema,
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
    const noDescR = deriveBackendToolDefinition(noDesc);
    expect(noDescR.ok).toBe(false);
    if (!noDescR.ok) {
      expect(noDescR.code).toBe('missing_backend_tool_description');
    }

    const noLabel = backendTask({
      id: 'e',
      label: '',
      backendToolDescription: 'Solo descrizione.',
      endpoint: { url: 'https://a', method: 'GET', headers: {} },
      inputs: [],
      outputs: [],
    });
    const noLabelR = deriveBackendToolDefinition(noLabel);
    expect(noLabelR.ok).toBe(false);
    if (!noLabelR.ok) {
      expect(noLabelR.code).toBe('missing_label');
    }
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

  it('mergeBookFromAgendaScopeIntoInputSchema overwrites scope keys with OpenAPI types', () => {
    const base = buildToolInputSchemaFromBackendInputs(
      [{ internalName: 'fr', apiParam: 'forceRefresh', variable: '' }],
      undefined
    );
    expect((base.properties as Record<string, { type?: string }>).forceRefresh?.type).toBe('string');
    const merged = mergeBookFromAgendaScopeIntoInputSchema(base);
    expect((merged.properties as Record<string, { type?: string }>).forceRefresh?.type).toBe('boolean');
    expect(merged.required).toEqual(expect.arrayContaining(['projectId', 'conversationId']));
  });

  it('mergeBookFromAgendaScopeIntoInputSchema forces queryConstraints to object (not string)', () => {
    const base = buildToolInputSchemaFromBackendInputs(
      [{ internalName: 'qc', apiParam: 'queryConstraints', variable: '' }],
      undefined
    );
    expect((base.properties as Record<string, { type?: string }>).queryConstraints?.type).toBe('string');
    const merged = mergeBookFromAgendaScopeIntoInputSchema(base);
    expect((merged.properties as Record<string, { type?: string }>).queryConstraints?.type).toBe('object');
  });

  it('keeps dotted OpenAPI keys (agenda.url / agenda.json) in tool schema', () => {
    const base = buildToolInputSchemaFromBackendInputs(
      [
        { internalName: 'agendaUrl', apiParam: 'agenda.url', variable: '' },
        { internalName: 'agendaType', apiParam: 'agenda.type', variable: '' },
      ],
      undefined
    );
    const props = base.properties as Record<string, { type?: string }>;
    expect(props['agenda.url']).toBeDefined();
    expect(props['agenda.type']).toBeDefined();
    expect(props['agenda_url']).toBeUndefined();
    expect(props['agenda_type']).toBeUndefined();
  });

  it('requires agenda source fields when BookFromAgenda schema exposes agenda.url', () => {
    const base = buildToolInputSchemaFromBackendInputs(
      [
        { internalName: 'agendaUrl', apiParam: 'agenda.url', variable: '' },
        { internalName: 'agendaType', apiParam: 'agenda.type', variable: '' },
      ],
      undefined
    );
    const merged = mergeBookFromAgendaScopeIntoInputSchema(base);
    expect(merged.required).toEqual(
      expect.arrayContaining(['projectId', 'conversationId', 'agenda.url', 'agenda.type'])
    );
  });

  it('locks BookFromAgenda infra params to SEND literals when provided', () => {
    const base = buildToolInputSchemaFromBackendInputs(
      [
        { internalName: 'u', apiParam: 'agenda.url', variable: 'https://real.feed/agenda' },
        { internalName: 't', apiParam: 'agenda.type', variable: 'Omnia' },
        { internalName: 'p', apiParam: 'projectId', variable: 'project_static' },
        { internalName: 'fr', apiParam: 'forceRefresh', variable: 'true' },
      ],
      undefined
    );
    const merged = mergeBookFromAgendaScopeIntoInputSchema(base as Record<string, unknown>, [
      { internalName: 'u', apiParam: 'agenda.url', variable: 'https://real.feed/agenda' },
      { internalName: 't', apiParam: 'agenda.type', variable: 'Omnia' },
      { internalName: 'p', apiParam: 'projectId', variable: 'project_static' },
      { internalName: 'fr', apiParam: 'forceRefresh', variable: 'true' },
    ]);
    const props = merged.properties as Record<string, Record<string, unknown>>;
    expect(props['agenda.url']?.enum).toEqual(['https://real.feed/agenda']);
    expect(props['agenda.type']?.enum).toEqual(['Omnia']);
    expect(props.projectId?.enum).toEqual(['project_static']);
    expect(props.forceRefresh?.enum).toEqual([true]);
  });

  it('buildToolInputSchemaFromBackendInputs uses openapiInputUiKindByApiName for boolean', () => {
    const task = backendTask({
      id: 'meta1',
      label: 'bf',
      backendToolDescription: 'Book.',
      endpoint: { url: 'https://x/api/runtime/bookfromagenda', method: 'POST', headers: {} },
      inputs: [{ internalName: 'fr', apiParam: 'forceRefresh', variable: '' }],
      outputs: [],
      backendCallSpecMeta: {
        schemaVersion: 1,
        lastImportedAt: null,
        contentHash: null,
        importState: 'ok',
        structuralFingerprint: null,
        openapiInputUiKindByApiName: { forceRefresh: 'boolean' },
      },
    });
    const s = buildToolInputSchemaFromBackendInputs(
      [{ internalName: 'fr', apiParam: 'forceRefresh', variable: '' }],
      task
    );
    expect((s.properties as Record<string, { type?: string }>).forceRefresh?.type).toBe('boolean');
  });

  it('buildToolInputSchemaFromBackendInputs prefers openapiInputJsonSchemaByApiName for nested objects', () => {
    const task = backendTask({
      id: 'meta2',
      label: 'bf',
      backendToolDescription: 'Book.',
      endpoint: { url: 'https://x/api/runtime/bookfromagenda', method: 'POST', headers: {} },
      inputs: [{ internalName: 'qc', apiParam: 'queryConstraints', variable: '' }],
      outputs: [],
      backendCallSpecMeta: {
        schemaVersion: 1,
        lastImportedAt: null,
        contentHash: null,
        importState: 'ok',
        structuralFingerprint: null,
        openapiInputUiKindByApiName: { queryConstraints: 'object' },
        openapiInputJsonSchemaByApiName: {
          queryConstraints: {
            type: 'object',
            properties: {
              weekdays: {
                type: 'array',
                items: { type: 'integer', minimum: 0, maximum: 6 },
              },
            },
          },
        },
      },
    });
    const s = buildToolInputSchemaFromBackendInputs(
      [{ internalName: 'qc', apiParam: 'queryConstraints', variable: '' }],
      task
    );
    const qc = (s.properties as Record<string, Record<string, unknown>>).queryConstraints;
    expect(qc?.type).toBe('object');
    expect((qc.properties as Record<string, unknown>).weekdays).toMatchObject({
      type: 'array',
      items: { type: 'integer', minimum: 0, maximum: 6 },
    });
  });

  it('mergeEffectiveIaAgentTools includes manualCatalogBackendTaskIds when cfg list is empty', () => {
    const cfg: IAAgentConfig = {
      platform: 'elevenlabs',
      model: 'convai_default',
      temperature: 0.5,
      maxTokens: 100,
      reasoning: 'none',
      systemPrompt: '',
      convaiBackendToolTaskIds: [],
    };

    const merged = mergeEffectiveIaAgentTools(
      cfg,
      (id) =>
        id === 'cat1'
          ? backendTask({
              id: 'cat1',
              label: 'Catalog backend',
              backendToolDescription: 'From catalog row.',
              endpoint: { url: 'https://api/', method: 'GET', headers: {} },
              inputs: [],
              outputs: [],
            })
          : null,
      { manualCatalogBackendTaskIds: ['cat1'] }
    );

    expect(merged.map((t) => t.name)).toEqual(['Catalog_backend']);
  });
});
