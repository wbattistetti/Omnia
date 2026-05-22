/**
 * Maps review-channel KB snapshots to {@link StagedKbDocument} for {@link KnowledgeBaseViewer}.
 */

import type { AgentReviewKnowledgeBaseSnapshot } from '@domain/agentReviewChannel/reviewSnapshots';
import type { StagedKbDocument } from '@domain/knowledgeBase/kbDocumentTypes';

function emptyFile(name: string, mimeType: string): File {
  try {
    return new File([], name, { type: mimeType || 'application/octet-stream' });
  } catch {
    return { name, size: 0, type: mimeType || 'application/octet-stream' } as File;
  }
}

/** Read-only staged documents for the review portal (no binary file on disk). */
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
    repositoryDocumentId: doc.repositoryDocumentId,
    dataTypes: doc.dataTypes ?? [],
    rules: [],
    chatStarted: false,
    semanticStatus: 'idle',
    chatMessages: [],
    analysisPhase: 'idle',
    consentGiven: false,
    currentRuleId: null,
    kbAnalysisComplete: false,
    promotionStatus: 'idle',
    promotedDrafts: [],
  }));
}
