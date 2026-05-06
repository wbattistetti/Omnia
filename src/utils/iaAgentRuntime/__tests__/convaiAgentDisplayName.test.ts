import { describe, expect, it } from 'vitest';
import { agentNameContainsTaskGuid, buildConvaiAgentDisplayName, convaiGuidMarker } from '../convaiAgentDisplayName';

describe('buildConvaiAgentDisplayName', () => {
  it('appende __GUID_ e mantiene il suffisso entro il limite', () => {
    const g = '550e8400-e29b-41d4-a716-446655440000';
    const n = buildConvaiAgentDisplayName({
      projectLabel: 'My Project',
      flowLabel: 'Main',
      nodeLabel: 'AI',
      taskGuid: g,
    });
    expect(n).toContain(convaiGuidMarker(g));
    expect(n).toMatch(/^OMNIA_/);
    expect(n.length).toBeLessThanOrEqual(120);
    expect(agentNameContainsTaskGuid(n, g)).toBe(true);
  });

  it('include cliente e versione nei segmenti OMNIA', () => {
    const g = '550e8400-e29b-41d4-a716-446655440001';
    const n = buildConvaiAgentDisplayName({
      projectLabel: 'Demo',
      flowLabel: 'Main',
      nodeLabel: 'Agent',
      taskGuid: g,
      omniaClientLabel: 'Acme',
      omniaVersionLabel: '2.1',
    });
    expect(n).toMatch(/^OMNIA_acme_/);
    expect(n).toContain(convaiGuidMarker(g));
    expect(n.length).toBeLessThanOrEqual(120);
  });
});
