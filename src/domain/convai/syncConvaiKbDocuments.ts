/**
 * Upload/sync documenti KB Omnia → ElevenLabs: upsert (PATCH) + purge orphan per nome.
 */

import type { StagedKbDocument } from '@domain/knowledgeBase/kbDocumentTypes';
import type { AgentElevenLabsConvaiLink } from './agentElevenLabsConvaiLink';
import {
  convaiKbDocNamesMatch,
  convaiKbSearchPrefixes,
} from './convaiKbDocNameMatch';
import {
  createConvaiKbDocumentFromText,
  deleteConvaiKbDocument,
  listAllConvaiKbDocumentsBySearch,
  updateConvaiKbDocumentFromText,
} from '@workspaces/elevenlabs/api/convaiKnowledgeBaseApi';

export type ConvaiKbRef = {
  type: string;
  name: string;
  id: string;
  usage_mode: string;
};

export type SyncConvaiKbDocumentsInput = {
  docs: readonly { doc: StagedKbDocument; text: string }[];
  existingLink: AgentElevenLabsConvaiLink | null;
  /** True se patch agente esistente (upsert + purge orphan). */
  isAgentUpdate: boolean;
  /** Id KB attualmente allegati all'agente (GET agent), oltre al link persistito. */
  remoteIdsOnAgent?: readonly string[];
  /** Nomi file Omnia correnti — per trovare ed eliminare duplicati in libreria ElevenLabs. */
  omniaDocNames?: readonly string[];
};

export type SyncConvaiKbDocumentsResult = {
  kbRefs: ConvaiKbRef[];
  kbRemoteByOmniaDocId: Record<string, string>;
  lastKbRemoteIds: string[];
  deletedRemoteIds: string[];
  purgeFailures: string[];
  kbUpdatedCount: number;
  kbCreatedCount: number;
};

function omniaDocLinkKey(doc: StagedKbDocument): string {
  return String(doc.id ?? '').trim();
}

function collectStaleRemoteIds(
  existingLink: AgentElevenLabsConvaiLink | null,
  remoteIdsOnAgent: readonly string[] | undefined,
  keepRemoteIds: ReadonlySet<string>
): string[] {
  const out = new Set<string>();
  for (const id of existingLink?.lastKbRemoteIds ?? []) {
    const t = id.trim();
    if (t && !keepRemoteIds.has(t)) out.add(t);
  }
  for (const id of Object.values(existingLink?.kbRemoteByOmniaDocId ?? {})) {
    const t = id.trim();
    if (t && !keepRemoteIds.has(t)) out.add(t);
  }
  for (const id of remoteIdsOnAgent ?? []) {
    const t = id.trim();
    if (t && !keepRemoteIds.has(t)) out.add(t);
  }
  return [...out];
}

/** Trova id remoti duplicati/orphan per nome file Omnia (match fuzzy, esclusi quelli tenuti). */
async function collectOrphanRemoteIdsByOmniaNames(
  omniaDocNames: readonly string[],
  keepRemoteIds: ReadonlySet<string>
): Promise<string[]> {
  const ids = new Set<string>();
  const searched = new Set<string>();

  for (const rawName of omniaDocNames) {
    const omniaName = String(rawName ?? '').trim();
    if (!omniaName) continue;

    for (const prefix of convaiKbSearchPrefixes(omniaName)) {
      if (searched.has(prefix)) continue;
      searched.add(prefix);

      const remoteDocs = await listAllConvaiKbDocumentsBySearch(prefix);
      for (const remote of remoteDocs) {
        if (keepRemoteIds.has(remote.id)) continue;
        if (convaiKbDocNamesMatch(omniaName, remote.name)) {
          ids.add(remote.id);
        }
      }
    }
  }

  return [...ids];
}

async function purgeRemoteKbIds(ids: readonly string[]): Promise<{
  deletedRemoteIds: string[];
  purgeFailures: string[];
}> {
  const deletedRemoteIds: string[] = [];
  const purgeFailures: string[] = [];

  for (const id of ids) {
    const trimmed = String(id ?? '').trim();
    if (!trimmed) continue;
    try {
      await deleteConvaiKbDocument(trimmed, { force: true });
      deletedRemoteIds.push(trimmed);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      purgeFailures.push(`${trimmed}: ${msg}`);
    }
  }

  return { deletedRemoteIds, purgeFailures };
}

async function upsertRemoteKbDocument(
  doc: StagedKbDocument,
  text: string,
  existingLink: AgentElevenLabsConvaiLink | null,
  isAgentUpdate: boolean
): Promise<{ remoteId: string; remoteName: string; mode: 'updated' | 'created' }> {
  const omniaId = omniaDocLinkKey(doc);
  const name = String(doc.name ?? '').trim() || 'Omnia KB document';
  const mappedId =
    isAgentUpdate && omniaId
      ? String(existingLink?.kbRemoteByOmniaDocId?.[omniaId] ?? '').trim()
      : '';

  if (mappedId) {
    try {
      await updateConvaiKbDocumentFromText(mappedId, { name, text });
      return { remoteId: mappedId, remoteName: name, mode: 'updated' };
    } catch {
      /* mapped id assente o invalido → create sotto */
    }
  }

  const created = await createConvaiKbDocumentFromText({ name, text });
  return {
    remoteId: created.id,
    remoteName: created.name || name,
    mode: 'created',
  };
}

/**
 * Sync KB: su update fa upsert per documento Omnia, poi elimina duplicati/orphan per nome e id stale.
 */
export async function syncConvaiKbDocuments(
  input: SyncConvaiKbDocumentsInput
): Promise<SyncConvaiKbDocumentsResult> {
  const kbRefs: ConvaiKbRef[] = [];
  const kbRemoteByOmniaDocId: Record<string, string> = {};
  const keptRemoteIds = new Set<string>();
  let kbUpdatedCount = 0;
  let kbCreatedCount = 0;

  for (const { doc, text } of input.docs) {
    const upsert = await upsertRemoteKbDocument(
      doc,
      text,
      input.existingLink,
      input.isAgentUpdate
    );
    if (upsert.mode === 'updated') kbUpdatedCount += 1;
    else kbCreatedCount += 1;

    const omniaId = omniaDocLinkKey(doc);
    if (omniaId) kbRemoteByOmniaDocId[omniaId] = upsert.remoteId;
    keptRemoteIds.add(upsert.remoteId);
    kbRefs.push({
      type: 'text',
      name: upsert.remoteName,
      id: upsert.remoteId,
      usage_mode: 'auto',
    });
  }

  let deletedRemoteIds: string[] = [];
  let purgeFailures: string[] = [];

  if (input.isAgentUpdate) {
    const staleIds = collectStaleRemoteIds(
      input.existingLink,
      input.remoteIdsOnAgent,
      keptRemoteIds
    );
    const orphanIds = await collectOrphanRemoteIdsByOmniaNames(
      input.omniaDocNames ?? [],
      keptRemoteIds
    );
    const toPurge = [...new Set([...staleIds, ...orphanIds])];

    if (toPurge.length > 0) {
      const purgeResult = await purgeRemoteKbIds(toPurge);
      deletedRemoteIds = purgeResult.deletedRemoteIds;
      purgeFailures = purgeResult.purgeFailures;

      if (purgeFailures.length > 0) {
        throw new Error(
          `Purge KB ElevenLabs incompleta (${purgeFailures.length} errori): ${purgeFailures.slice(0, 3).join('; ')}`
        );
      }
    }
  }

  return {
    kbRefs,
    kbRemoteByOmniaDocId,
    lastKbRemoteIds: [...keptRemoteIds],
    deletedRemoteIds,
    purgeFailures,
    kbUpdatedCount,
    kbCreatedCount,
  };
}
