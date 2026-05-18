import { describe, expect, it } from 'vitest';
import type { UseCaseConversationalJson } from '../useCaseJsonProjection';
import { serializeConversationalCatalog } from '../serializeConversationalCatalog';

function sampleProjected(): UseCaseConversationalJson[] {
  return [
    {
      useCaseId: 'uc-1',
      label: 'Interno',
      scenario: 'INGRESSO|saluto',
      variants: [
        {
          variantId: 'default',
          tokenizedExample: 'Ciao [nome].',
          tokens: ['nome'],
        },
      ],
      log: 'USECASE: "INTERNO"',
    },
  ];
}

describe('serializeConversationalCatalog', () => {
  it('json-pretty emits full projection with useCaseId (baseline storica)', () => {
    const out = serializeConversationalCatalog(sampleProjected(), 'json-pretty');
    expect(out).toContain('### Use case 1');
    expect(out).toContain('"useCaseId": "uc-1"');
    expect(out).toContain('"tokenizedExample": "Ciao [nome]."');
    expect(out).toContain('"tokens":');
    expect(out).not.toContain('Indice use case');
  });

  it('json-compact is shorter than json-pretty', () => {
    const pretty = serializeConversationalCatalog(sampleProjected(), 'json-pretty');
    const compact = serializeConversationalCatalog(sampleProjected(), 'json-compact');
    expect(compact.length).toBeLessThan(pretty.length);
    expect(compact).not.toContain('"useCaseId"');
  });

  it('json-minimal uses short keys without index', () => {
    const out = serializeConversationalCatalog(sampleProjected(), 'json-minimal');
    expect(out).not.toContain('Indice use case');
    expect(out).toContain('"s":"INGRESSO|saluto"');
    expect(out).toContain('"t":"Ciao [nome]."');
  });

  it('dsl-standard uses compact UC blocks', () => {
    const out = serializeConversationalCatalog(sampleProjected(), 'dsl-standard');
    expect(out).toContain('[1] INGRESSO|saluto');
    expect(out).toContain('> Ciao [nome].');
    expect(out).not.toContain('VARIANT');
  });

  it('dsl-ultra does not repeat scenario on second variant', () => {
    const projected: UseCaseConversationalJson[] = [
      {
        useCaseId: 'uc-1',
        label: 'X',
        scenario: 'SCENARIO_LUNGO_UNA_VOLTA',
        variants: [
          {
            variantId: 'v1',
            tokenizedExample: 'Prima [a].',
            tokens: ['a'],
            when: 'condizione uno',
          },
          {
            variantId: 'v2',
            tokenizedExample: 'Seconda [b].',
            tokens: ['b'],
          },
        ],
      },
    ];
    const out = serializeConversationalCatalog(projected, 'dsl-ultra');
    expect(out).toContain('SCENARIO_LUNGO_UNA_VOLTA');
    const occurrences = out.split('SCENARIO_LUNGO_UNA_VOLTA').length - 1;
    expect(occurrences).toBe(1);
    expect(out).toContain('>Seconda [b].');
  });
});
