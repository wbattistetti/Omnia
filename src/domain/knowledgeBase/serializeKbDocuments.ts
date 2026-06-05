/**
 * Parse / serialize KB document lists stored on AI Agent tasks (`agentKnowledgeBaseDocumentsJson`).
 */

import type { PersistedKbDocument, StagedKbDocument } from './kbDocumentTypes';
import { persistedKbToStaged, stagedKbToPersisted } from './kbDocumentTypes';
import { normalizePersistedKbRepositoryLink } from './kbRepositoryContract';

function isPersistedKbDocument(row: unknown): row is PersistedKbDocument {
  if (!row || typeof row !== 'object') return false;
  const r = row as Record<string, unknown>;
  return typeof r.id === 'string' && typeof r.name === 'string' && typeof r.parseStatus === 'string';
}

/** Reads persisted KB documents from task JSON; invalid rows are dropped. */
export function parseAgentKnowledgeBaseDocumentsJson(raw: string): PersistedKbDocument[] {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isPersistedKbDocument)
      .map((row) => normalizePersistedKbRepositoryLink(stagedKbToPersisted(persistedKbToStaged(row))));
  } catch {
    return [];
  }
}

export function serializeAgentKnowledgeBaseDocuments(docs: readonly PersistedKbDocument[]): string {
  if (docs.length === 0) return '';
  const normalized = docs.map((d) => normalizePersistedKbRepositoryLink(stagedKbToPersisted(persistedKbToStaged(d))));
  return JSON.stringify(normalized);
}

/** Task JSON KB merged with live editor documents (live wins when non-empty). */
export function resolveAgentKnowledgeBaseDocumentsJson(
  taskJson: string | undefined | null,
  liveDocuments?: readonly StagedKbDocument[] | null
): string {
  const live = liveDocuments ?? [];
  if (live.length > 0) {
    const persisted = live.map((d) => normalizePersistedKbRepositoryLink(stagedKbToPersisted(d)));
    return serializeAgentKnowledgeBaseDocuments(persisted);
  }
  return String(taskJson ?? '').trim();
}
