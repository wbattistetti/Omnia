/**
 * Maps review-channel KB snapshots ↔ {@link StagedKbDocument} for the review portal.
 */

import type {
  AgentReviewKnowledgeBaseSnapshot,
  AgentReviewKbDocumentSnapshot,
} from '@domain/agentReviewChannel/reviewSnapshots';
import type { StagedKbDocument } from '@domain/knowledgeBase/kbDocumentTypes';

function emptyFile(name: string, mimeType: string): File {
  try {
    return new File([], name, { type: mimeType || 'application/octet-stream' });
  } catch {
    return { name, size: 0, type: mimeType || 'application/octet-stream' } as File;
  }
}

/** Staged documents from review snapshot (repository id preserved for re-fetch). */
export function stagedKbDocumentsFromReviewSnapshot(
  snapshot: AgentReviewKnowledgeBaseSnapshot | null | undefined
): readonly StagedKbDocument[] {
  if (!snapshot?.documents?.length) return [];
  return snapshot.documents.map((doc) => ({
    id: doc.id,
    name: doc.name,
    size: doc.size,
    mimeType: doc.mimeType,
    addedAt: doc.addedAt,
    file: emptyFile(doc.name, doc.mimeType),
    parseStatus: doc.parseStatus,
    parseError: doc.parseError,
    format: doc.format as StagedKbDocument['format'],
    variables: [],
    variableDictionary: {},
    howToUseText: doc.howToUseText ?? '',
    markdownSnippet: doc.markdownSnippet ?? '',
    documentAnalysisMarkdown: doc.documentAnalysisMarkdown ?? '',
    agentAnalysisBaselineMarkdown: doc.agentAnalysisBaselineMarkdown ?? '',
    repositoryDocumentId: doc.repositoryDocumentId,
  }));
}

function stagedDocToReviewSnapshot(doc: StagedKbDocument): AgentReviewKbDocumentSnapshot {
  return {
    id: doc.id,
    name: doc.name,
    size: doc.size,
    mimeType: doc.mimeType,
    addedAt: doc.addedAt,
    parseStatus: doc.parseStatus,
    ...(doc.parseError ? { parseError: doc.parseError } : {}),
    ...(doc.format ? { format: doc.format } : {}),
    ...(doc.howToUseText?.trim() ? { howToUseText: doc.howToUseText } : {}),
    ...(doc.markdownSnippet?.trim() ? { markdownSnippet: doc.markdownSnippet } : {}),
    ...(doc.documentAnalysisMarkdown?.trim()
      ? { documentAnalysisMarkdown: doc.documentAnalysisMarkdown }
      : {}),
    ...(doc.agentAnalysisBaselineMarkdown?.trim()
      ? { agentAnalysisBaselineMarkdown: doc.agentAnalysisBaselineMarkdown }
      : {}),
    ...(doc.repositoryDocumentId ? { repositoryDocumentId: doc.repositoryDocumentId } : {}),
  };
}

/** Persisted review snapshot from live staged docs (portal autosave). */
export function reviewKbSnapshotFromStagedDocuments(
  documents: readonly StagedKbDocument[]
): AgentReviewKnowledgeBaseSnapshot | null {
  if (documents.length === 0) return null;
  return { documents: documents.map(stagedDocToReviewSnapshot) };
}

export function reviewKbSnapshotsEqual(
  a: AgentReviewKnowledgeBaseSnapshot | null | undefined,
  b: AgentReviewKnowledgeBaseSnapshot | null | undefined
): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}
