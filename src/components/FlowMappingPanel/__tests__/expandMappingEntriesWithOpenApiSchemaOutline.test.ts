import { describe, expect, it } from 'vitest';
import { createMappingEntry } from '../mappingTypes';
import { expandMappingEntriesWithOpenApiSchemaOutline } from '../expandMappingEntriesWithOpenApiSchemaOutline';

describe('expandMappingEntriesWithOpenApiSchemaOutline', () => {
  it('aggiunge figli virtuali sotto constraints object', () => {
    const entries = [
      createMappingEntry({
        wireKey: 'constraints',
        apiField: 'constraints',
        fieldDescription: 'Vincoli opzionali',
      }),
      createMappingEntry({ wireKey: 'id', apiField: 'id' }),
    ];
    const expanded = expandMappingEntriesWithOpenApiSchemaOutline(entries, 'send', {
      importState: 'ok',
      openapiInputJsonSchemaByApiName: {
        constraints: {
          type: 'object',
          properties: {
            allowedWeekdays: {
              type: 'array',
              items: { type: 'integer', minimum: 0, maximum: 6 },
              description: 'Giorni ammessi',
            },
            forbiddenWeekdays: {
              type: 'array',
              items: { type: 'integer' },
            },
          },
        },
      },
    });
    expect(expanded.some((e) => e.wireKey === 'constraints.allowedWeekdays')).toBe(true);
    expect(expanded.some((e) => e.wireKey === 'constraints.forbiddenWeekdays')).toBe(true);
    const virtual = expanded.find((e) => e.wireKey === 'constraints.allowedWeekdays');
    expect(virtual?.schemaOutlineOnly).toBe(true);
    expect(virtual?.openapiFormatLabel).toContain('array · integer');
  });

  it('non duplica wireKey già presenti', () => {
    const entries = [
      createMappingEntry({ wireKey: 'constraints', apiField: 'constraints' }),
      createMappingEntry({ wireKey: 'constraints.allowedWeekdays', apiField: 'allowedWeekdays' }),
    ];
    const expanded = expandMappingEntriesWithOpenApiSchemaOutline(entries, 'send', {
      importState: 'ok',
      openapiInputJsonSchemaByApiName: {
        constraints: {
          type: 'object',
          properties: {
            allowedWeekdays: { type: 'array', items: { type: 'integer' } },
          },
        },
      },
    });
    expect(expanded.filter((e) => e.wireKey === 'constraints.allowedWeekdays')).toHaveLength(1);
    expect(expanded.find((e) => e.wireKey === 'constraints.allowedWeekdays')?.schemaOutlineOnly).not.toBe(
      true
    );
  });
});
