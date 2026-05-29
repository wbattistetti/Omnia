import { describe, expect, it } from 'vitest';
import { collectRemainingOpenApiRefs } from '../openApiSchemaRefValidation';

describe('collectRemainingOpenApiRefs', () => {
  it('finds top-level and nested $ref', () => {
    const refs = collectRemainingOpenApiRefs({
      type: 'object',
      properties: {
        a: { $ref: '#/components/schemas/A' },
      },
    });
    expect(refs.some((r) => r.includes('a') && r.includes('#/components/schemas/A'))).toBe(true);
  });

  it('finds x-omnia-unresolvedRef marker', () => {
    const refs = collectRemainingOpenApiRefs({
      'x-omnia-unresolvedRef': '#/components/schemas/Gone',
    });
    expect(refs).toHaveLength(1);
    expect(refs[0]).toContain('ref non risolto');
  });
});
