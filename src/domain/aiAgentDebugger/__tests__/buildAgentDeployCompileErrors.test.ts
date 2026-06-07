import { describe, expect, it } from 'vitest';
import { buildAgentDeployCompileErrors } from '../buildAgentDeployCompileErrors';

describe('buildAgentDeployCompileErrors', () => {
  it('maps KB issues to IaProvisionProviderError for debugger report', () => {
    const errors = buildAgentDeployCompileErrors(
      'task-1',
      [{ code: 'kb_missing', message: 'Nessun documento knowledge base sul task agente.' }],
      ['ElevenLabs: configura la voce nello step Voce prima del sync.']
    );
    expect(errors).toHaveLength(2);
    expect(errors[0]?.code).toBe('IaProvisionProviderError');
    expect(errors[0]?.message).toContain('knowledge base');
    expect(errors[1]?.message).toContain('voce');
  });

  it('returns empty for empty task id', () => {
    expect(buildAgentDeployCompileErrors('', [{ code: 'x', message: 'y' }])).toEqual([]);
  });
});
