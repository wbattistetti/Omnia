/**
 * Parse / serialize KB document lists stored on AI Agent tasks (`agentKnowledgeBaseDocumentsJson`).
 */

import type { PersistedKbDocument } from './kbDocumentTypes';
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
