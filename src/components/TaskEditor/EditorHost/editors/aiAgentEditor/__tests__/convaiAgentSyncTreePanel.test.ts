import { describe, expect, it } from 'vitest';
import { buildSyncActionLabel } from '../ConvaiAgentSyncTreePanel';

describe('buildSyncActionLabel', () => {
  it('labels new agent creation', () => {
    expect(buildSyncActionLabel(null, true, '  Mia Bot  ')).toBe('Crea Mia Bot');
    expect(buildSyncActionLabel(null, true, '')).toBe('Crea agente');
  });

  it('labels root agent update', () => {
    expect(
      buildSyncActionLabel(
        { scope: 'root', agentId: 'a1', displayName: 'Test Walter' },
        false,
        ''
      )
    ).toBe('Aggiorna Test Walter');
  });

  it('labels workflow node as parent.child', () => {
    expect(
      buildSyncActionLabel(
        {
          scope: 'workflow',
          agentId: 'a1',
          agentDisplayName: 'Test Walter',
          nodeId: 'n1',
          nodeLabel: 'Preferenza medico',
        },
        false,
        ''
      )
    ).toBe('Aggiorna Test Walter.Preferenza medico');
  });
});
