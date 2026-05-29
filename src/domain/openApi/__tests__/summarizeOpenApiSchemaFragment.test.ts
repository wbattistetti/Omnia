import { describe, expect, it } from 'vitest';
import { summarizeOpenApiSchemaFragment } from '../summarizeOpenApiSchemaFragment';

describe('summarizeOpenApiSchemaFragment', () => {
  it('summarizes integer with bounds', () => {
    expect(
      summarizeOpenApiSchemaFragment({
        type: 'array',
        items: { type: 'integer', minimum: 0, maximum: 6 },
      })
    ).toContain('type array');
    expect(
      summarizeOpenApiSchemaFragment({
        type: 'array',
        items: { type: 'integer', minimum: 0, maximum: 6 },
      })
    ).toContain('minimum 0');
  });

  it('summarizes string with format', () => {
    expect(summarizeOpenApiSchemaFragment({ type: 'string', format: 'date-time' })).toBe(
      'type string, format date-time'
    );
  });
});
