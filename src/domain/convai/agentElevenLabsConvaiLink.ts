/**
 * Collegamento persistente task Omnia ↔ agente ConvAI ElevenLabs + mapping documenti KB remoti.
 */

export const AGENT_ELEVENLABS_CONVAI_LINK_SCHEMA_VERSION = 1 as const;

export type AgentElevenLabsConvaiLink = {
  schemaVersion: typeof AGENT_ELEVENLABS_CONVAI_LINK_SCHEMA_VERSION;
  /** Id agente ElevenLabs collegato a questo task Omnia. */
  agentId: string;
  /** Nome visualizzato al momento dell'ultimo sync. */
  agentName?: string;
  lastSyncedAt?: string;
  /** Documento KB Omnia (`StagedKbDocument.id`) → id documento remoto ElevenLabs. */
  kbRemoteByOmniaDocId: Record<string, string>;
  /** Id KB remoti allegati all'agente nell'ultimo sync (per cleanup orphan). */
  lastKbRemoteIds: string[];
};

export function emptyAgentElevenLabsConvaiLink(): AgentElevenLabsConvaiLink {
  return {
    schemaVersion: AGENT_ELEVENLABS_CONVAI_LINK_SCHEMA_VERSION,
    agentId: '',
    kbRemoteByOmniaDocId: {},
    lastKbRemoteIds: [],
  };
}

export function parseAgentElevenLabsConvaiLinkJson(
  raw: string | undefined | null
): AgentElevenLabsConvaiLink | null {
  if (!raw || typeof raw !== 'string' || !raw.trim()) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== 'object') return null;
    const o = v as Record<string, unknown>;
    const agentId = typeof o.agentId === 'string' ? o.agentId.trim() : '';
    if (!agentId) return null;
    const kbRemoteByOmniaDocId: Record<string, string> = {};
    if (o.kbRemoteByOmniaDocId && typeof o.kbRemoteByOmniaDocId === 'object') {
      for (const [k, val] of Object.entries(o.kbRemoteByOmniaDocId as Record<string, unknown>)) {
        if (typeof val === 'string' && val.trim()) kbRemoteByOmniaDocId[k] = val.trim();
      }
    }
    const lastKbRemoteIds = Array.isArray(o.lastKbRemoteIds)
      ? o.lastKbRemoteIds.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
      : [];
    return {
      schemaVersion: AGENT_ELEVENLABS_CONVAI_LINK_SCHEMA_VERSION,
      agentId,
      ...(typeof o.agentName === 'string' && o.agentName.trim()
        ? { agentName: o.agentName.trim() }
        : {}),
      ...(typeof o.lastSyncedAt === 'string' && o.lastSyncedAt.trim()
        ? { lastSyncedAt: o.lastSyncedAt.trim() }
        : {}),
      kbRemoteByOmniaDocId,
      lastKbRemoteIds,
    };
  } catch {
    return null;
  }
}

export function serializeAgentElevenLabsConvaiLink(link: AgentElevenLabsConvaiLink): string {
  return JSON.stringify(link);
}

/** Risolve agentId collegato: link persistito sul task, poi sessione tab. */
export function resolveLinkedConvaiAgentId(
  link: AgentElevenLabsConvaiLink | null,
  sessionAgentId: string | undefined
): string {
  const fromLink = link?.agentId?.trim() ?? '';
  if (fromLink) return fromLink;
  return String(sessionAgentId ?? '').trim();
}
