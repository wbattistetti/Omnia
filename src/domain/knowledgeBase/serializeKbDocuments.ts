/**
 * Parse / serialize KB document lists stored on AI Agent tasks (`agentKnowledgeBaseDocumentsJson`).
 */

import { normalizeKbRules } from './kbRuleTypes';
import type { PersistedKbDocument } from './kbDocumentTypes';

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
    return parsed.filter(isPersistedKbDocument).map((row) => ({
      ...row,
      dataTypes: Array.isArray(row.dataTypes)
        ? row.dataTypes.map((t) => String(t).trim()).filter(Boolean)
        : [],
      rules: normalizeKbRules(row.rules),
      chatStarted: Boolean(row.chatStarted),
      chatMessages: Array.isArray(row.chatMessages) ? row.chatMessages : [],
      semanticStatus: row.semanticStatus ?? 'idle',
    }));
  } catch {
    return [];
  }
}

export function serializeAgentKnowledgeBaseDocuments(docs: readonly PersistedKbDocument[]): string {
  if (docs.length === 0) return '';
  return JSON.stringify(docs);
}
