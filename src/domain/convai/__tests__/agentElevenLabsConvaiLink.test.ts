import { describe, expect, it } from 'vitest';
import {
  parseAgentElevenLabsConvaiLinkJson,
  resolveLinkedConvaiAgentId,
  serializeAgentElevenLabsConvaiLink,
} from '../agentElevenLabsConvaiLink';

describe('agentElevenLabsConvaiLink', () => {
  it('parses valid link json', () => {
    const raw = JSON.stringify({
      schemaVersion: 1,
      agentId: 'ag_1',
      agentName: 'Paros Medici',
      kbRemoteByOmniaDocId: { doc_a: 'kb_x' },
      lastKbRemoteIds: ['kb_x', 'kb_y'],
    });
    const link = parseAgentElevenLabsConvaiLinkJson(raw);
    expect(link?.agentId).toBe('ag_1');
    expect(link?.agentName).toBe('Paros Medici');
    expect(link?.kbRemoteByOmniaDocId.doc_a).toBe('kb_x');
    expect(link?.lastKbRemoteIds).toEqual(['kb_x', 'kb_y']);
  });

  it('returns null for invalid json', () => {
    expect(parseAgentElevenLabsConvaiLinkJson('')).toBeNull();
    expect(parseAgentElevenLabsConvaiLinkJson('{}')).toBeNull();
    expect(parseAgentElevenLabsConvaiLinkJson('not-json')).toBeNull();
  });

  it('round-trips serialize', () => {
    const raw = serializeAgentElevenLabsConvaiLink({
      schemaVersion: 1,
      agentId: 'ag_2',
      agentName: 'Test',
      kbRemoteByOmniaDocId: {},
      lastKbRemoteIds: [],
    });
    expect(parseAgentElevenLabsConvaiLinkJson(raw)?.agentId).toBe('ag_2');
  });

  it('resolveLinkedConvaiAgentId prefers persisted link', () => {
    expect(
      resolveLinkedConvaiAgentId(
        { schemaVersion: 1, agentId: 'from_link', kbRemoteByOmniaDocId: {}, lastKbRemoteIds: [] },
        'from_session'
      )
    ).toBe('from_link');
    expect(resolveLinkedConvaiAgentId(null, 'from_session')).toBe('from_session');
  });
});
