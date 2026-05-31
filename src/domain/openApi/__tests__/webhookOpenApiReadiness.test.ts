import { describe, expect, it } from 'vitest';
import { TaskType, type Task } from '@types/taskTypes';
import {
  applicableReportFieldsForEntry,
  buildAgentWebhookReadinessReport,
  buildBackendWebhookReadiness,
  formatWebhookReadinessReport,
  groupReportEntriesByTree,
  nestingDepthForReportPath,
  resolveSchemaAtReportPath,
} from '../webhookOpenApiReadiness';

function backendTask(partial: Record<string, unknown>): Task {
  return {
    id: 'bk1',
    type: TaskType.BackendCall,
    label: 'next_window',
    backendToolDescription: 'Restituisce la prossima finestra disponibile in agenda.',
    inputs: [{ internalName: 'horizon', apiParam: 'horizon', fieldDescription: 'Intervallo date' }],
    outputs: [{ internalName: 'slots', apiParam: 'slots' }],
    backendCallSpecMeta: {
      importState: 'ok',
      openapiInputJsonSchemaByApiName: {
        horizon: { type: 'string', description: 'Data di inizio ricerca' },
      },
      openapiOutputJsonSchemaByApiName: {
        slots: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              time: { type: 'string', format: 'date-time', description: 'Istante slot ISO' },
            },
          },
        },
      },
    },
    ...partial,
  } as Task;
}

describe('webhookOpenApiReadiness', () => {
  it('segnala BLOCKER su string SEND senza format/enum', () => {
    const r = buildBackendWebhookReadiness(backendTask({}));
    const horizon = r.entries.find((e) => e.path === 'horizon');
    expect(horizon?.severity).toBe('blocker');
    expect(horizon?.gaps.some((g) => g.includes('format'))).toBe(true);
  });

  it('include RECEIVE con nota assenza webhook', () => {
    const r = buildBackendWebhookReadiness(backendTask({}));
    const slots = r.entries.find((e) => e.path.startsWith('slots'));
    expect(slots?.direction).toBe('receive');
    expect(slots?.inConvaiTool).toBe(false);
  });

  it('formatWebhookReadinessReport include intestazione e backend', () => {
    const report = buildAgentWebhookReadinessReport({
      backendTaskIds: ['bk1'],
      getTask: () => backendTask({}),
    });
    const text = formatWebhookReadinessReport(report);
    expect(text).toContain('Report readiness OpenAPI');
    expect(text).toContain('next_window');
    expect(text).toContain('BLOCKER');
  });

  it('risolve schema annidato slots[].date', () => {
    const slotsSchema = {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          date: { type: 'string', format: 'date', description: 'Giorno dello slot' },
          time: { type: 'string', format: 'time' },
        },
      },
    };
    const node = resolveSchemaAtReportPath(slotsSchema, 'slots[].date', 'slots');
    expect(node?.type).toBe('string');
    expect(node?.format).toBe('date');
  });

  it('nested RECEIVE slots[].date ha values non assente', () => {
    const r = buildBackendWebhookReadiness(
      backendTask({
        outputs: [{ internalName: 'slots', apiParam: 'slots' }],
        backendCallSpecMeta: {
          importState: 'ok',
          openapiOutputJsonSchemaByApiName: {
            slots: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  date: { type: 'string', format: 'date', description: 'Giorno dello slot in agenda' },
                  time: { type: 'string', format: 'time', description: 'Ora locale HH:mm' },
                },
              },
            },
          },
        },
      })
    );
    const dateEntry = r.entries.find((e) => e.path === 'slots[].date');
    expect(dateEntry?.values.type).toBe('string');
    expect(dateEntry?.values.format).toBe('date');
    expect(dateEntry?.severity).not.toBe('warning');
  });

  it('import mancante → blocker su tutti i wire param', () => {
    const r = buildBackendWebhookReadiness(
      backendTask({
        backendCallSpecMeta: { importState: 'pending' },
      })
    );
    expect(r.entries.every((e) => e.severity === 'blocker')).toBe(true);
    expect(r.entries[0]?.gaps[0]).toContain('non importato');
  });

  it('boolean: report mostra solo type e description (niente min/max, format, pattern)', () => {
    const entry = {
      direction: 'receive' as const,
      inConvaiTool: false,
      auditProfile: 'receive-passive' as const,
      values: {
        type: 'boolean',
        description: 'true se agenda terminata',
      },
      present: {
        type: true,
        format: false,
        enum: false,
        minMax: false,
        pattern: false,
        description: true,
        xAgentInstructions: false,
        xOpenaiIsConsequential: false,
      },
    };
    expect(applicableReportFieldsForEntry(entry)).toEqual(['type', 'description']);
  });

  it('summary.totalSlots RECEIVE → OK passivo senza warning', () => {
    const r = buildBackendWebhookReadiness(
      backendTask({
        outputs: [
          { internalName: 'summary', apiParam: 'summary' },
        ],
        backendCallSpecMeta: {
          importState: 'ok',
          openapiInputJsonSchemaByApiName: {
            horizon: { type: 'string', format: 'date', description: 'Data di inizio ricerca' },
          },
          openapiOutputJsonSchemaByApiName: {
            summary: {
              type: 'object',
              properties: {
                totalSlots: { type: 'integer' },
                freeSlots: { type: 'integer' },
              },
            },
          },
        },
      })
    );
    const total = r.entries.find((e) => e.path === 'summary.totalSlots');
    expect(total?.auditProfile).toBe('receive-passive');
    expect(total?.severity).toBe('ok');
    expect(total?.gaps).toEqual([]);
  });

  it('string senza dominio: include format, enum, pattern e x-agent-instructions', () => {
    const entry = {
      direction: 'send' as const,
      inConvaiTool: true,
      auditProfile: 'send-input' as const,
      values: { type: 'string' },
      present: {
        type: true,
        format: false,
        enum: false,
        minMax: false,
        pattern: false,
        description: false,
        xAgentInstructions: false,
        xOpenaiIsConsequential: false,
      },
    };
    expect(applicableReportFieldsForEntry(entry)).toEqual([
      'type',
      'format',
      'enum',
      'pattern',
      'description',
      'xAgentInstructions',
    ]);
  });

  it('integer con min/max: niente x-agent-instructions', () => {
    const entry = {
      direction: 'send' as const,
      inConvaiTool: true,
      auditProfile: 'send-input' as const,
      values: { type: 'integer', minimum: 0, maximum: 6 },
      present: {
        type: true,
        format: false,
        enum: false,
        minMax: true,
        pattern: false,
        description: true,
        xAgentInstructions: false,
        xOpenaiIsConsequential: false,
      },
    };
    expect(applicableReportFieldsForEntry(entry)).toEqual([
      'type',
      'minMax',
      'enum',
      'description',
    ]);
  });

  it('SEND constraints object: OpenAPI risolto e figli annidati', () => {
    const constraintsSchema = {
      type: 'object',
      description:
        'Filtri opzionali per selezionare solo gli slot desiderati. Tutti i campi sono opzionali.',
      properties: {
        allowedWeekdays: {
          type: 'array',
          items: { type: 'integer', minimum: 0, maximum: 6 },
          description: 'Giorni ammessi 0-6',
        },
        forbiddenWeekdays: {
          type: 'array',
          items: { type: 'integer', minimum: 0, maximum: 6 },
        },
      },
    };
    const r = buildBackendWebhookReadiness(
      backendTask({
        inputs: [
          { internalName: 'c', apiParam: 'constraints', fieldDescription: 'Vincoli opzionali' },
          { internalName: 'id', apiParam: 'id', fieldDescription: 'Id richiesta' },
          {
            internalName: 'wd',
            apiParam: 'windowDays',
            fieldDescription: 'Giorni finestra',
          },
        ],
        backendCallSpecMeta: {
          importState: 'ok',
          openapiInputUiKindByApiName: {
            constraints: 'object',
            id: 'text',
            windowDays: 'number',
          },
          openapiInputJsonSchemaByApiName: {
            constraints: constraintsSchema,
            id: {
              type: 'string',
              pattern: '^[a-z0-9_-]+$',
              description: 'Identificativo richiesta',
            },
            windowDays: {
              type: 'integer',
              minimum: 1,
              maximum: 30,
              description: 'Numero giorni consecutivi',
            },
          },
        },
      })
    );
    const constraints = r.entries.find((e) => e.path === 'constraints');
    expect(constraints?.openapiSummary).not.toBe('(assente)');
    expect(constraints?.values.type).toBe('object');
    expect(constraints?.gaps.some((g) => g.includes('schema OpenAPI assente'))).toBe(false);
    expect(r.entries.some((e) => e.path === 'constraints.allowedWeekdays')).toBe(true);
    const id = r.entries.find((e) => e.path === 'id');
    expect(id?.openapiSummary).toContain('string');
    expect(id?.gaps.some((g) => g.includes('schema OpenAPI assente'))).toBe(false);
  });

  it('groupReportEntriesByTree raggruppa constraints e figli', () => {
    const entries = [
      {
        path: 'constraints',
        rootKey: 'constraints',
        nestingDepth: 0,
        direction: 'send' as const,
        inConvaiTool: true,
        auditProfile: 'send-input' as const,
        auditNote: '',
        present: {} as never,
        values: { type: 'object' },
        gaps: [],
        severity: 'ok' as const,
        openapiSummary: '',
        elevenLabsSummary: '',
      },
      {
        path: 'constraints.allowedWeekdays',
        rootKey: 'constraints',
        nestingDepth: 1,
        direction: 'send' as const,
        inConvaiTool: true,
        auditProfile: 'send-input' as const,
        auditNote: '',
        present: {} as never,
        values: { type: 'array' },
        gaps: [],
        severity: 'ok' as const,
        openapiSummary: '',
        elevenLabsSummary: '',
      },
      {
        path: 'id',
        rootKey: 'id',
        nestingDepth: 0,
        direction: 'send' as const,
        inConvaiTool: true,
        auditProfile: 'send-input' as const,
        auditNote: '',
        present: {} as never,
        values: { type: 'string' },
        gaps: [],
        severity: 'ok' as const,
        openapiSummary: '',
        elevenLabsSummary: '',
      },
    ];
    const groups = groupReportEntriesByTree(entries);
    expect(groups).toHaveLength(2);
    expect(groups[0].map((e) => e.path)).toEqual([
      'constraints',
      'constraints.allowedWeekdays',
    ]);
    expect(nestingDepthForReportPath('constraints.allowedWeekdays', 'constraints')).toBe(1);
  });

  it('formatWebhookReadinessReport boolean non elenca min/max', () => {
    const report = buildAgentWebhookReadinessReport({
      backendTaskIds: ['bk1'],
      getTask: () =>
        backendTask({
          outputs: [{ internalName: 'done', apiParam: 'done' }],
          backendCallSpecMeta: {
            importState: 'ok',
            openapiInputJsonSchemaByApiName: {
              horizon: { type: 'string', format: 'date', description: 'Data di inizio ricerca' },
            },
            openapiOutputJsonSchemaByApiName: {
              done: {
                type: 'boolean',
                description: 'true se agenda terminata e non ci sono piu giorni',
              },
            },
          },
        }),
    });
    const text = formatWebhookReadinessReport(report);
    expect(text).toMatch(/RECEIVE · done \(solo prompt\)/);
    expect(text).toContain('type boolean');
    expect(text).toContain('Output backend');
    expect(text).not.toMatch(/done[\s\S]*min\/max/);
  });
});
