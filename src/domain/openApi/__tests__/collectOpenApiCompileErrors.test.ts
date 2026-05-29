import { describe, expect, it } from 'vitest';
import {
  collectOpenApiCompileErrors,
  formatOpenApiCompileErrorsReport,
} from '../collectOpenApiCompileErrors';

describe('collectOpenApiCompileErrors', () => {
  it('accetta integer array con min/max (weekdays)', () => {
    const errors = collectOpenApiCompileErrors({
      jsonSchemasByApiName: {
        weekdays: {
          type: 'array',
          items: { type: 'integer', minimum: 0, maximum: 6 },
        },
      },
    });
    expect(errors).toEqual([]);
  });

  it('segnala array di string senza enum su items', () => {
    const errors = collectOpenApiCompileErrors({
      jsonSchemasByApiName: {
        weekday: {
          type: 'array',
          items: { type: 'string' },
        },
      },
    });
    expect(errors.some((e) => e.includes('weekday[]'))).toBe(true);
    expect(errors.some((e) => e.includes('spec incompleta'))).toBe(true);
  });

  it('segnala string top-level senza format/enum', () => {
    const errors = collectOpenApiCompileErrors({
      jsonSchemasByApiName: {
        'agenda.url': { type: 'string', description: 'URL' },
      },
    });
    expect(errors).toContain('agenda.url: string senza format, enum o pattern — spec incompleta');
  });

  it('accetta string con format date-time', () => {
    const errors = collectOpenApiCompileErrors({
      jsonSchemasByApiName: {
        start: { type: 'string', format: 'date-time' },
      },
    });
    expect(errors).toEqual([]);
  });

  it('valida nested object properties', () => {
    const errors = collectOpenApiCompileErrors({
      jsonSchemasByApiName: {
        queryConstraints: {
          type: 'object',
          properties: {
            weekdays: {
              type: 'array',
              items: { type: 'integer', minimum: 0, maximum: 6 },
            },
            label: { type: 'string' },
          },
        },
      },
    });
    expect(errors).toContain(
      'queryConstraints.label: string senza format, enum o pattern — spec incompleta'
    );
  });

  it('segnala $ref non risolto negli schema materializzati', () => {
    const errors = collectOpenApiCompileErrors({
      jsonSchemasByApiName: {
        constraints: {
          type: 'object',
          properties: {
            horizon: { $ref: '#/components/schemas/MissingHorizon' },
          },
        },
      },
    });
    expect(errors.some((e) => e.includes('constraints.horizon'))).toBe(true);
    expect(errors.some((e) => e.includes('ref non risolto'))).toBe(true);
    expect(errors.some((e) => e.includes('spec incompleta'))).toBe(true);
  });

  it('formatOpenApiCompileErrorsReport include intestazione', () => {
    const text = formatOpenApiCompileErrorsReport(['a: err — spec incompleta']);
    expect(text).toContain('Spec incompleta');
    expect(text).toContain('a: err');
  });
});
