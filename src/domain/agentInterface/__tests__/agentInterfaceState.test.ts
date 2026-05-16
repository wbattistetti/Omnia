import { describe, expect, it } from 'vitest';
import {
  agentInterfaceRowsToMappingEntries,
  mappingEntriesToAgentInterfaceRows,
  parseAgentInterfaceJson,
  serializeAgentInterfaceJson,
} from '../agentInterfaceState';

describe('agentInterfaceState', () => {
  it('round-trips wireKey-only rows', () => {
    const json = serializeAgentInterfaceJson({
      schemaVersion: 1,
      input: [{ id: 'a1', wireKey: 'sessionId', sourceBackendTaskId: 'b1', sourceSide: 'send' }],
      output: [{ id: 'o1', wireKey: 'result' }],
    });
    const parsed = parseAgentInterfaceJson(json);
    expect(parsed.input).toHaveLength(1);
    expect(parsed.input[0]?.wireKey).toBe('sessionId');
    expect(parsed.output[0]?.wireKey).toBe('result');
  });

  it('mapping entry adapters preserve wireKey', () => {
    const entries = agentInterfaceRowsToMappingEntries([
      { id: 'x', wireKey: 'foo', variableRefId: 'vid-1' },
    ]);
    const rows = mappingEntriesToAgentInterfaceRows(entries);
    expect(rows[0]?.wireKey).toBe('foo');
    expect(rows[0]?.variableRefId).toBe('vid-1');
  });

  it('parse tolerates invalid JSON', () => {
    expect(parseAgentInterfaceJson('{bad').input).toEqual([]);
  });
});
