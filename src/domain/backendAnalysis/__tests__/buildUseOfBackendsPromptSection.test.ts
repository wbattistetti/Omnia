import { describe, expect, it, vi, beforeEach } from 'vitest';
import { TaskType, type Task } from '@types/taskTypes';
import type { ProjectBackendCatalogBlob } from '@domain/backendCatalog/catalogTypes';
import {
  BACKEND_RECEIVE_SECTION_HEADER,
  USE_OF_BACKENDS_SECTION_HEADER,
  buildUseOfBackendsPromptSection,
  mergeUseOfBackendsIntoContext,
  stripUseOfBackendsFromContext,
} from '../buildUseOfBackendsPromptSection';
import { OPENAPI_CONTRACT_MISSING_PREFIX } from '@domain/openApi/buildOpenApiParamContractLines';

const getTask = vi.fn();
vi.mock('@services/TaskRepository', () => ({
  taskRepository: { getTask: (...args: unknown[]) => getTask(...args) },
}));

const bk1Task = {
  id: 'bk1',
  type: TaskType.BackendCall,
  label: 'next-window',
  backendToolDescription: 'Iterazione agenda.',
  inputs: [
    { apiParam: 'windowDays', variable: 'w' },
    { apiParam: 'constraints', variable: 'c' },
  ],
  outputs: [
    { apiField: 'slots', variable: 's' },
    { apiField: 'done', variable: 'd' },
  ],
  backendCallSpecMeta: {
    schemaVersion: 1 as const,
    lastImportedAt: '2026-01-01T00:00:00.000Z',
    contentHash: 'h1',
    importState: 'ok' as const,
    structuralFingerprint: 'fp',
        openapiInputJsonSchemaByApiName: {
          windowDays: { type: 'integer', minimum: 1, maximum: 30 },
          constraints: {
            type: 'object',
            properties: {
              weekdays: {
                type: 'array',
                items: { type: 'integer', minimum: 0, maximum: 6 },
              },
            },
          },
        },
        openapiOutputJsonSchemaByApiName: {
          slots: { type: 'array', items: { type: 'object' } },
          done: { type: 'boolean' },
        },
    openapiInputUiKindByApiName: {},
    openapiInputEnumByApiName: {},
  },
} as Task;

describe('buildUseOfBackendsPromptSection', () => {
  beforeEach(() => {
    getTask.mockReset();
  });

  it('builds contract lines with type/format from OpenAPI meta', () => {
    const catalog: ProjectBackendCatalogBlob = {
      catalogVersion: 1,
      manualEntries: [{ id: 'bk1', label: 'next-window' }],
      auditLog: [],
      agentAnalysisByTaskId: {
        agent1: {
          analysisDocument: {
            schemaVersion: 2,
            global: { agentSystemPromptMarkdown: '', proposedBackends: [] },
            backends: {
              bk1: {
                catalogEntryId: 'bk1',
                displayLabel: 'next-window',
                howToUseMarkdown: 'Uso iterativo di next-window.',
                parameters: {
                  windowDays: {
                    paramKey: 'windowDays',
                    direction: 'input',
                    kind: 'optional',
                    role: 'Giorni finestra',
                    descriptionShort: '',
                    analysisDetailMarkdown: '',
                    analysisSummary: '',
                  },
                  constraints: {
                    paramKey: 'constraints',
                    direction: 'input',
                    kind: 'required',
                    role: 'filtri preferenze',
                    descriptionShort: '',
                    analysisDetailMarkdown: '',
                    analysisSummary: '',
                  },
                  slots: {
                    paramKey: 'slots',
                    direction: 'output',
                    kind: 'required',
                    role: 'lista slot',
                    descriptionShort: '',
                    analysisDetailMarkdown: '',
                    analysisSummary: '',
                  },
                },
                suggestedFeatures: [],
              },
            },
          },
          analysisMarkdown: '',
          agentAnalysisBaselineMarkdown: 'baseline',
          sectionBaselines: {},
        },
      },
    };

    getTask.mockImplementation((id: string) => (id === 'bk1' ? bk1Task : null));

    const section = buildUseOfBackendsPromptSection({
      catalog,
      agentTaskId: 'agent1',
      manualCatalogBackendTaskIds: ['bk1'],
      mode: 'full',
    });

    expect(section).toContain(USE_OF_BACKENDS_SECTION_HEADER);
    expect(section).toContain('### next-window');
    expect(section).toContain('Contract (OpenAPI');
    expect(section).toContain('→ windowDays: type integer');
    expect(section).toContain('→ constraints: type object');
    expect(section).toContain('← slots:');
    expect(section).not.toContain('→ constraints: filtri preferenze');
    expect(section).not.toContain('Note IA');
    expect(section).toContain('constraints.weekdays');
  });

  it('includes public backend URL and HTTP method', () => {
    getTask.mockImplementation((id: string) =>
      id === 'bk1'
        ? ({
            ...bk1Task,
            endpoint: {
              url: 'https://api.example.com/v1/next-window',
              method: 'post',
            },
          } as Task)
        : null
    );

    const section = buildUseOfBackendsPromptSection({
      agentTaskId: 'agent1',
      manualCatalogBackendTaskIds: ['bk1'],
      mode: 'full',
    });

    expect(section).toContain('URL: https://api.example.com/v1/next-window');
    expect(section).toContain('Method: POST');
  });

  it('marks MISSING when string param has no format in schema', () => {
    getTask.mockImplementation(() =>
      ({
        ...bk1Task,
        inputs: [{ apiParam: 'agenda.url', variable: 'u' }],
        backendCallSpecMeta: {
          ...bk1Task.backendCallSpecMeta!,
          openapiInputJsonSchemaByApiName: {
            'agenda.url': { type: 'string', description: 'URL' },
          },
        },
      }) as Task
    );

    const section = buildUseOfBackendsPromptSection({
      agentTaskId: 'agent1',
      manualCatalogBackendTaskIds: ['bk1'],
      mode: 'full',
    });

    expect(section).toContain(OPENAPI_CONTRACT_MISSING_PREFIX);
    expect(section).toContain('agenda.url');
    expect(section).toContain('string senza format');
  });

  it('falls back to wire keys with MISSING when OpenAPI not imported', () => {
    getTask.mockImplementation(() =>
      ({
        id: 'bk2',
        type: TaskType.BackendCall,
        label: 'Catalog API',
        inputs: [{ apiParam: 'query', variable: 'fixed' }],
        outputs: [{ apiField: 'items', variable: 'out' }],
      }) as Task
    );

    const section = buildUseOfBackendsPromptSection({
      agentTaskId: 'agent1',
      manualCatalogBackendTaskIds: ['bk2'],
      mode: 'full',
    });

    expect(section).toContain('### Catalog API');
    expect(section).toContain(OPENAPI_CONTRACT_MISSING_PREFIX);
    expect(section).toContain('→ query:');
  });

  it('slim mode omits SEND, URL and Method but keeps RECEIVE', () => {
    getTask.mockImplementation((id: string) => (id === 'bk1' ? bk1Task : null));

    const section = buildUseOfBackendsPromptSection({
      agentTaskId: 'agent1',
      manualCatalogBackendTaskIds: ['bk1'],
      mode: 'slim',
    });

    expect(section).toContain(BACKEND_RECEIVE_SECTION_HEADER);
    expect(section).toContain('← slots:');
    expect(section).not.toContain('→ windowDays:');
    expect(section).not.toContain('URL:');
    expect(section).not.toContain('Method:');
  });

  it('slim mode returns empty when only SEND and tool description exist', () => {
    getTask.mockImplementation(() =>
      ({
        id: 'bk3',
        type: TaskType.BackendCall,
        label: 'Write only',
        backendToolDescription: 'Solo invio dati.',
        inputs: [{ apiParam: 'payload', variable: 'p' }],
        backendCallSpecMeta: {
          schemaVersion: 1 as const,
          lastImportedAt: '2026-01-01T00:00:00.000Z',
          contentHash: 'h',
          importState: 'ok' as const,
          structuralFingerprint: 'fp',
          openapiInputJsonSchemaByApiName: { payload: { type: 'object' } },
          openapiInputUiKindByApiName: {},
          openapiInputEnumByApiName: {},
        },
      }) as Task
    );

    const section = buildUseOfBackendsPromptSection({
      agentTaskId: 'agent1',
      manualCatalogBackendTaskIds: ['bk3'],
      mode: 'slim',
    });

    expect(section).toBe('');
  });

  it('mergeUseOfBackendsIntoContext replaces stale section', () => {
    const oldSection = `${USE_OF_BACKENDS_SECTION_HEADER}\n\n### Old\nContract:\n  → x: OLD`;
    const ctx = mergeUseOfBackendsIntoContext('intro', oldSection);
    const newSection = `${USE_OF_BACKENDS_SECTION_HEADER}\n\n### New\n  → y: type string, format date`;
    const updated = mergeUseOfBackendsIntoContext(ctx, newSection);
    expect(updated).toContain('intro');
    expect(updated).toContain('### New');
    expect(updated).not.toContain('### Old');
    expect(stripUseOfBackendsFromContext(updated)).toBe('intro');
    const slimOld = `${BACKEND_RECEIVE_SECTION_HEADER}\n\n### Old receive`;
    const slimNew = `${BACKEND_RECEIVE_SECTION_HEADER}\n\n### New receive`;
    const slimUpdated = mergeUseOfBackendsIntoContext(slimOld, slimNew);
    expect(slimUpdated).toContain('### New receive');
    expect(slimUpdated).not.toContain('### Old receive');
  });
});
