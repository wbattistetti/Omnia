import { describe, it, expect } from 'vitest';
import { validateDDTTemplateV2 } from '../../model/ddt.v2.schema';

describe('DDT V2 schema validation', () => {
  const base = {
    schemaVersion: '2',
    metadata: { id: 'DDT_X', label: 'X' },
    nodes: [
      {
        id: 'main',
        label: 'Main',
        type: 'main',
        kind: 'generic',
        steps: {
          ask: { base: 'ask.base', reaskNoInput: ['', '', ''], reaskNoMatch: ['', '', ''] },
          confirm: { base: 'confirm.base', noInput: ['', '', ''], noMatch: ['', '', ''] },
          success: { base: ['ok'] },
        },
      },
    ],
  };

  it('valid document passes', () => {
    const res = validateDDTTemplateV2(base);
    expect(res.valid).toBe(true);
    expect(res.issues.length).toBe(0);
  });

  it('invalid lengths fail', () => {
    const bad = JSON.parse(JSON.stringify(base));
    bad.nodes[0].steps.ask.reaskNoInput = ['only1'];
    const res = validateDDTTemplateV2(bad);
    expect(res.valid).toBe(false);
    expect(res.issues.some((i: any) => String(i.path).includes('reaskNoInput'))).toBe(true);
  });
});


