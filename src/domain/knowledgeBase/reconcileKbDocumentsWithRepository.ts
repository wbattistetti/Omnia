/**
 * Dopo hydrate: migra blob con id repository obsoleto e verifica presenza su disco.
 */

import type { StagedKbDocument } from './kbDocumentTypes';
import type { KbDocumentListUpdater } from './kbDocumentIngest';
import {
  adoptKbRepositoryDocumentId,
  fetchKbDocumentMeta,
} from '@services/kbDocumentRepositoryApi';
import {
  kbDocumentHasLocalReadableText,
  kbRepositoryKeyForDoc,
  normalizePersistedKbRepositoryLink,
} from './kbRepositoryContract';
import { persistedKbToStaged, stagedKbToPersisted, type PersistedKbDocument } from './kbDocumentTypes';
import { isInvalidationKbDocument } from './useCaseInvalidationKb';

const MISSING_REPO_MESSAGE =
  'File assente nel repository progetto. Ricarica il documento dalla Knowledge Base.';

/**
 * Applica contratto id↔repository e verifica blob (nessun lookup per nome file).
 */
export async function reconcileKbDocumentsWithRepository(
  projectId: string | undefined,
  rows: readonly PersistedKbDocument[],
  setDocuments: KbDocumentListUpdater
): Promise<void> {
  const pid = String(projectId ?? '').trim();
  if (!pid || rows.length === 0) return;

  for (const row of rows) {
    if (isInvalidationKbDocument(row as StagedKbDocument)) continue;
    const id = String(row.id ?? '').trim();
    const legacyRid = String(row.repositoryDocumentId ?? '').trim();
    if (!id || !legacyRid || legacyRid === id) continue;
    try {
      await adoptKbRepositoryDocumentId(pid, id, legacyRid);
    } catch {
      /* blob assente anche sull’id legacy */
    }
  }

  const normalized = rows.map(normalizePersistedKbRepositoryLink);

  const checks = await Promise.all(
    normalized.map(async (row) => {
      if (isInvalidationKbDocument(row as StagedKbDocument)) {
        return { row, exists: true };
      }
      const id = kbRepositoryKeyForDoc(row);
      if (!id) return { row, exists: false };
      try {
        await fetchKbDocumentMeta(pid, id);
        return { row, exists: true };
      } catch {
        return { row, exists: false };
      }
    })
  );

  setDocuments((prev) =>
    prev.map((d) => {
      const hit = checks.find((c) => c.row.id === d.id);
      if (!hit) return d;
      const repoKey = kbRepositoryKeyForDoc(d);
      if (hit.exists) {
        return {
          ...d,
          repositoryDocumentId: repoKey,
          parseStatus: d.parseStatus === 'error' ? ('ready' as const) : d.parseStatus,
          parseError: undefined,
        };
      }
      if (kbDocumentHasLocalReadableText(d)) {
        return {
          ...d,
          repositoryDocumentId: repoKey,
          parseStatus: 'ready' as const,
          parseError: undefined,
        };
      }
      return {
        ...d,
        repositoryDocumentId: repoKey,
        parseStatus: 'error' as const,
        parseError: MISSING_REPO_MESSAGE,
      };
    })
  );
}

/** Normalizza righe persistite prima di staged/hydrate. */
export function normalizeKbDocumentsForPersist(
  docs: readonly PersistedKbDocument[]
): PersistedKbDocument[] {
  return docs.map((d) => normalizePersistedKbRepositoryLink(stagedKbToPersisted(persistedKbToStaged(d))));
}
