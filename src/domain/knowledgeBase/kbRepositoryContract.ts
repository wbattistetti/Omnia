/**
 * Contratto repository KB progetto: un documento caricato = un id = chiave blob su disco.
 */

import type { PersistedKbDocument, StagedKbDocument } from './kbDocumentTypes';
import { isInvalidationKbDocument } from './useCaseInvalidationKb';

/** Documenti upload devono usare `id` anche come chiave repository. */
export function kbRepositoryKeyForDoc(doc: {
  id: string;
  repositoryDocumentId?: string;
  kbDocumentKind?: StagedKbDocument['kbDocumentKind'];
}): string {
  return String(doc.id || '').trim();
}

/** Allinea `repositoryDocumentId` a `id` (note invalidazione escluse). */
export function normalizePersistedKbRepositoryLink(row: PersistedKbDocument): PersistedKbDocument {
  if (isInvalidationKbDocument(row as StagedKbDocument)) {
    return row;
  }
  const id = String(row.id || '').trim();
  if (!id) return row;
  const rid = String(row.repositoryDocumentId ?? '').trim();
  if (rid === id) {
    return { ...row, repositoryDocumentId: id };
  }
  return {
    ...row,
    repositoryDocumentId: id,
    ...(rid
      ? {
          parseError:
            row.parseStatus === 'error'
              ? row.parseError
              : `Repository KB non allineato (${rid} ≠ ${id}): verifica in corso o ricarica il file.`,
        }
      : {}),
  };
}

/** True se il documento ha testo utilizzabile senza leggere il repository. */
export function kbDocumentHasLocalReadableText(doc: StagedKbDocument): boolean {
  const analysis = String(doc.documentAnalysisMarkdown ?? '').trim();
  const snippet = String(doc.markdownSnippet ?? '').trim();
  if (analysis.length >= 80) return true;
  if (snippet.length >= 80) return true;
  if (isInvalidationKbDocument(doc) && analysis.length > 0) return true;
  const howTo = String(doc.howToUseText ?? '').trim();
  if (howTo.length >= 40) return true;
  return false;
}
