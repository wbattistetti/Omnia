import { describe, expect, it } from 'vitest';
import { subflowInterfaceOutputMappingKey } from '../subflowVariableMappingKey';

describe('subflowInterfaceOutputMappingKey', () => {
  it('is deterministic for the same inputs', () => {
    const a = subflowInterfaceOutputMappingKey('task-1', 'var-2');
    const b = subflowInterfaceOutputMappingKey('task-1', 'var-2');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('differs when subflow task id differs', () => {
    const a = subflowInterfaceOutputMappingKey('task-a', 'same-var');
    const b = subflowInterfaceOutputMappingKey('task-b', 'same-var');
    expect(a).not.toBe(b);
  });
});
