import { describe, it, expect } from 'vitest';
import { adaptCurrentToV2 } from '../../model/adapters/currentToV2';

const current = {
  id: 'DDT_Date',
  label: 'Date',
  translations: {},
  data: {
    id: 'date',
    label: 'Date',
    type: 'date',
    required: true,
    steps: [
      { type: 'start', escalations: [] },
      { type: 'noMatch', escalations: [] },
      { type: 'noInput', escalations: [] },
      { type: 'confirmation', escalations: [] },
      { type: 'success', escalations: [] },
    ],
    subData: [
      { id: 'day', label: 'Day', type: 'generic', steps: [], subData: [] },
      { id: 'month', label: 'Month', type: 'generic', steps: [], subData: [] },
      { id: 'year', label: 'Year', type: 'generic', steps: [], subData: [] },
    ],
  },
};

describe('adapter current -> V2', () => {
  it('maps fields and creates nodes for main + subs', () => {
    const v2 = adaptCurrentToV2(current as any);
    expect(v2.schemaVersion).toBe('2');
    expect(v2.metadata.id).toBe('DDT_Date');
    expect(v2.nodes.length).toBe(4);
    expect(v2.nodes[0].type).toBe('main');
    expect(v2.nodes.slice(1).every((n) => n.type === 'sub')).toBe(true);
    expect(v2.nodes[0].steps.ask.base).toBe('ask.base');
    expect(v2.nodes[0].steps.confirm?.noInput.length).toBe(3);
    expect(v2.nodes[0].steps.confirm?.noMatch.length).toBe(3);
  });
});


