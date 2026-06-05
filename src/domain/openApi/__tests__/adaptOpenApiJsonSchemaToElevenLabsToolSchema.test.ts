import { describe, expect, it } from 'vitest';
import {
  adaptOpenApiPropertiesToElevenLabs,
  toElevenLabsQueryParamsSchema,
  toElevenLabsRequestBodySchema,
} from '../adaptOpenApiJsonSchemaToElevenLabsToolSchema';

describe('adaptOpenApiJsonSchemaToElevenLabsToolSchema', () => {
  it('espande constraints object con proprietà annidate', () => {
    const body = toElevenLabsRequestBodySchema({
      type: 'object',
      properties: {
        windowDays: {
          type: 'integer',
          minimum: 1,
          maximum: 30,
          description: 'Giorni consecutivi.',
        },
        constraints: {
          type: 'object',
          description: 'Vincoli opzionali.',
          properties: {
            weekdays: {
              type: 'array',
              items: { type: 'integer', minimum: 0, maximum: 6 },
            },
            allowedMonths: {
              type: 'array',
              items: { type: 'integer', minimum: 1, maximum: 12 },
            },
          },
        },
      },
      required: ['windowDays'],
    });

    const props = body.properties as Record<string, Record<string, unknown>>;
    expect(props.windowDays).toEqual(
      expect.objectContaining({
        type: 'integer',
        minimum: 1,
        maximum: 30,
        description: 'Giorni consecutivi.',
      })
    );

    const c = props.constraints;
    expect(c.type).toBe('object');
    expect(c.description).toBe('Vincoli opzionali.');
    const cProps = c.properties as Record<string, Record<string, unknown>>;
    expect(cProps.weekdays.type).toBe('array');
    expect(cProps.weekdays.items).toEqual(
      expect.objectContaining({ type: 'integer', minimum: 0, maximum: 6 })
    );
    expect(cProps.allowedMonths.items).toEqual(
      expect.objectContaining({ type: 'integer', minimum: 1, maximum: 12 })
    );
    expect(body.required).toEqual(['windowDays']);
  });

  it('imposta description radice su request_body_schema', () => {
    const body = toElevenLabsRequestBodySchema(
      { type: 'object', properties: { id: { type: 'string' } } },
      { description: 'Crea prenotazione agenda.' }
    );
    expect(body.description).toBe('Crea prenotazione agenda.');
    expect(body.type).toBe('object');
  });

  it('query_params_schema non include description radice (extra_forbidden API)', () => {
    const qps = toElevenLabsQueryParamsSchema(
      { type: 'object', properties: { id: { type: 'string' } } },
      { description: 'Lista slot disponibili.' }
    );
    expect(qps).not.toHaveProperty('description');
    expect(qps).toHaveProperty('properties');
  });

  it('rimuove additionalProperties e adatta enum boolean', () => {
    const props = adaptOpenApiPropertiesToElevenLabs({
      forceRefresh: { type: 'boolean', enum: [true, false], description: 'Refresh' },
      queryConstraints: {
        type: 'object',
        additionalProperties: false,
        properties: { label: { type: 'string', format: 'date' } },
      },
    });
    expect(props.forceRefresh).toEqual(
      expect.objectContaining({
        type: 'string',
        enum: ['true', 'false'],
      })
    );
    const qc = props.queryConstraints as Record<string, unknown>;
    expect(qc).not.toHaveProperty('additionalProperties');
    expect((qc.properties as Record<string, unknown>).label).toEqual(
      expect.objectContaining({ type: 'string', format: 'date' })
    );
  });

  it('query_params_schema coerces object/array properties to string (ConvAI EU)', () => {
    const qps = toElevenLabsQueryParamsSchema({
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Id richiesta' },
        windowDays: { type: 'integer', minimum: 1, maximum: 30 },
        constraints: {
          type: 'object',
          description: 'Vincoli opzionali.',
          properties: {
            weekdays: { type: 'array', items: { type: 'integer' } },
          },
        },
      },
      required: ['id'],
    });
    const props = qps.properties as Record<string, Record<string, unknown>>;
    expect(props.id).toEqual(expect.objectContaining({ type: 'string' }));
    expect(props.windowDays).toEqual(expect.objectContaining({ type: 'integer' }));
    expect(props.constraints).toEqual({
      type: 'string',
      description: 'Vincoli opzionali. (passa come stringa JSON)',
    });
    expect(qps).not.toHaveProperty('type');
  });

  it('merge allOf in property schema', () => {
    const props = adaptOpenApiPropertiesToElevenLabs({
      constraints: {
        allOf: [
          {
            type: 'object',
            properties: {
              weekdays: { type: 'array', items: { type: 'integer' } },
            },
          },
        ],
        description: 'Merged constraints',
      },
    });
    const c = props.constraints as Record<string, unknown>;
    expect(c.type).toBe('object');
    const nested = (c.properties as Record<string, unknown>).weekdays as Record<string, unknown>;
    expect(nested.type).toBe('array');
  });
});
