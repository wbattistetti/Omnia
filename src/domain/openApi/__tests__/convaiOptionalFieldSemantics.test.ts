import { describe, expect, it } from 'vitest';
import {
  CONVAI_OPTIONAL_EMPTY_STRING_RULE_ID,
  enrichOpenApiInputSchemasForConvaiOptionalSemantics,
  formatConvaiOptionalFieldSemanticsReportSection,
  isConvaiEmptyOptionalSentinel,
  OPENAPI_OPTIONAL_FIELD_DESCRIPTION_SUFFIX,
  stripEmptyConvaiOptionalFields,
} from '../convaiOptionalFieldSemantics';
import { buildOpenApiParamContractPreamble } from '../buildOpenApiParamContractLines';
import { formatWebhookReadinessReport, buildBackendWebhookReadiness } from '../webhookOpenApiReadiness';
import { TaskType, type Task } from '@types/taskTypes';

describe('convaiOptionalFieldSemantics', () => {
  it('stripEmptyConvaiOptionalFields removes ElevenLabs-style empty constraints', () => {
    const inbound = {
      windowDays: 10,
      constraints: {
        horizon: { start: '', end: '' },
        forbiddenWeekdays: [],
        allowedWeekdays: [],
      },
    };
    expect(stripEmptyConvaiOptionalFields(inbound)).toEqual({ windowDays: 10 });
  });

  it('isConvaiEmptyOptionalSentinel detects empty string and empty containers', () => {
    expect(isConvaiEmptyOptionalSentinel('')).toBe(true);
    expect(isConvaiEmptyOptionalSentinel([])).toBe(true);
    expect(isConvaiEmptyOptionalSentinel({})).toBe(true);
    expect(isConvaiEmptyOptionalSentinel(0)).toBe(false);
    expect(isConvaiEmptyOptionalSentinel('x')).toBe(false);
  });

  it('enrichOpenApiInputSchemasForConvaiOptionalSemantics annotates optional fields', () => {
    const enriched = enrichOpenApiInputSchemasForConvaiOptionalSemantics(
      {
        windowDays: { type: 'integer', description: 'Giorni' },
        constraints: {
          type: 'object',
          properties: {
            horizon: {
              type: 'object',
              properties: {
                start: { type: 'string', format: 'date' },
              },
            },
          },
        },
      },
      ['windowDays'],
      ['constraints']
    );
    expect(enriched.constraints.description).toContain('opzionale');
    const startDesc = (
      enriched.constraints.properties as Record<string, Record<string, unknown>>
    ).horizon.properties.start.description as string;
    expect(startDesc).toContain(OPENAPI_OPTIONAL_FIELD_DESCRIPTION_SUFFIX.trim());
    expect(enriched.windowDays.convaiOptionalSemantics).toBe(CONVAI_OPTIONAL_EMPTY_STRING_RULE_ID);
  });

  it('buildOpenApiParamContractPreamble includes rule id', () => {
    const lines = buildOpenApiParamContractPreamble();
    expect(lines.some((l) => l.includes(CONVAI_OPTIONAL_EMPTY_STRING_RULE_ID))).toBe(true);
  });

  it('formatWebhookReadinessReport includes ConvAI standard section', () => {
    const task = {
      id: 'bk1',
      type: TaskType.BackendCall,
      label: 'next',
      backendToolDescription: 'Desc tool sufficientemente lunga.',
      inputs: [{ internalName: 'w', apiParam: 'windowDays' }],
      outputs: [],
      backendCallSpecMeta: {
        importState: 'ok',
        convaiOptionalEmptyStringRuleId: CONVAI_OPTIONAL_EMPTY_STRING_RULE_ID,
        openapiInputJsonSchemaByApiName: {
          windowDays: { type: 'integer', minimum: 1 },
        },
      },
    } as Task;
    const readiness = buildBackendWebhookReadiness(task);
    expect(readiness.convaiOptionalRuleDocumented).toBe(true);
    const text = formatWebhookReadinessReport({
      generatedAt: new Date().toISOString(),
      backendCount: 1,
      backends: [readiness],
      totalBlockers: 0,
      totalWarnings: 0,
    });
    expect(text).toContain('Standard API backend ConvAI');
    expect(formatConvaiOptionalFieldSemanticsReportSection()[0]).toContain('Standard');
  });
});
