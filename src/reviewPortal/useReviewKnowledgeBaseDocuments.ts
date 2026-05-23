/**
 * KB documents nel portale review: stesso hook Omnia + sync snapshot ↔ review store.
 */

import React from 'react';
import type { AgentReviewKnowledgeBaseSnapshot } from '@domain/agentReviewChannel/reviewSnapshots';
import { useKnowledgeBaseDocuments } from '@domain/knowledgeBase/useKnowledgeBaseDocuments';
import {
  reviewKbSnapshotFromStagedDocuments,
  reviewKbSnapshotsEqual,
  stagedKbDocumentsFromReviewSnapshot,
} from './mapReviewKbSnapshot';

export interface UseReviewKnowledgeBaseDocumentsParams {
  projectId: string;
  channelLoaded: boolean;
  sessionKey: string;
  knowledgeBaseSnapshot: AgentReviewKnowledgeBaseSnapshot | null;
  setKnowledgeBaseSnapshot: (snapshot: AgentReviewKnowledgeBaseSnapshot | null) => void;
}

export type UseReviewKnowledgeBaseDocumentsResult = ReturnType<typeof useKnowledgeBaseDocuments>;

/** Live KB list + handlers identici all'editor Omnia; persiste nel review store. */
export function useReviewKnowledgeBaseDocuments({
  projectId,
  channelLoaded,
  sessionKey,
  knowledgeBaseSnapshot,
  setKnowledgeBaseSnapshot,
}: UseReviewKnowledgeBaseDocumentsParams): UseReviewKnowledgeBaseDocumentsResult {
  const {
    documents,
    addFiles,
    removeDocument,
    updateDocument,
    reorderDocuments,
    hydrateFromPersisted,
    toPersisted,
  } = useKnowledgeBaseDocuments({ projectId });

  const hydratedKeyRef = React.useRef<string | null>(null);
  const skipSyncRef = React.useRef(false);

  React.useEffect(() => {
    if (!channelLoaded) {
      hydratedKeyRef.current = null;
      return;
    }
    if (hydratedKeyRef.current === sessionKey) return;
    hydratedKeyRef.current = sessionKey;
    skipSyncRef.current = true;
    const staged = stagedKbDocumentsFromReviewSnapshot(knowledgeBaseSnapshot);
    hydrateFromPersisted(staged.map(({ file: _file, ...rest }) => rest));
  }, [channelLoaded, sessionKey, knowledgeBaseSnapshot, hydrateFromPersisted]);

  React.useEffect(() => {
    if (!channelLoaded || hydratedKeyRef.current !== sessionKey) return;
    if (skipSyncRef.current) {
      skipSyncRef.current = false;
      return;
    }
    const next = reviewKbSnapshotFromStagedDocuments(documents);
    if (!reviewKbSnapshotsEqual(knowledgeBaseSnapshot, next)) {
      setKnowledgeBaseSnapshot(next);
    }
  }, [
    channelLoaded,
    sessionKey,
    documents,
    knowledgeBaseSnapshot,
    setKnowledgeBaseSnapshot,
  ]);

  return {
    documents,
    addFiles,
    removeDocument,
    updateDocument,
    reorderDocuments,
    hydrateFromPersisted,
    toPersisted,
  };
}
