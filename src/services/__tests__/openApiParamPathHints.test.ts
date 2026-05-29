import { describe, expect, it } from 'vitest';
import { schemaPropertyParamHintsByPath } from '../openApiParamPathHints';

describe('schemaPropertyParamHintsByPath', () => {
  it('collects nested property descriptions and examples', () => {
    const doc = {
      openapi: '3.0.0',
      components: { schemas: {} },
    };
    const schema = {
      type: 'object',
      properties: {
        agenda: {
          type: 'object',
          description: 'Agenda payload',
          properties: {
            start: {
              type: 'string',
              format: 'date',
              description: 'Start date',
              example: '2026-05-27',
            },
            end: {
              type: 'string',
              format: 'date',
              description: 'End date',
              example: '2026-05-30',
            },
          },
        },
      },
    };
    const hints = schemaPropertyParamHintsByPath(doc, schema);
    expect(hints.agenda?.description).toBe('Agenda payload');
    expect(hints['agenda.start']?.description).toBe('Start date');
    expect(hints['agenda.start']?.example).toBe('2026-05-27');
    expect(hints['agenda.start']?.format).toBe('date');
  });
});
