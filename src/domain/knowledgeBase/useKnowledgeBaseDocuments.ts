/**
 * In-memory KB list: upload to project repository, tabular parse, semantic state on each doc.
 */

import React from 'react';
import {
  deleteKbRepositoryBlob,
  runKbDocumentIngest,
  stageKbFilesFromUpload,
} from './kbDocumentIngest';
import {
  persistedKbToStaged,
  stagedKbToPersisted,
  type KbDocumentPatch,
  type PersistedKbDocument,
  type StagedKbDocument,
} from './kbDocumentTypes';

export type UseKnowledgeBaseDocumentsOptions = {
  projectId: string | undefined;
  onDirty?: () => void;
};

export type UseKnowledgeBaseDocumentsResult = {
  documents: readonly StagedKbDocument[];
  addFiles: (files: readonly File[]) => void;
  removeDocument: (docId: string) => void;
  updateDocument: (docId: string, patch: KbDocumentPatch) => void;
  toPersisted: () => PersistedKbDocument[];
  hydrateFromPersisted: (rows: readonly PersistedKbDocument[]) => void;
};

export function useKnowledgeBaseDocuments(
  options: UseKnowledgeBaseDocumentsOptions = { projectId: undefined }
): UseKnowledgeBaseDocumentsResult {
  const projectId = options.projectId;
  const onDirty = options.onDirty;

  const [documents, setDocuments] = React.useState<StagedKbDocument[]>([]);

  const hydrateFromPersisted = React.useCallback((rows: readonly PersistedKbDocument[]) => {
    setDocuments(rows.map(persistedKbToStaged));
  }, []);

  const markDirty = React.useCallback(() => {
    onDirty?.();
  }, [onDirty]);

  const addFiles = React.useCallback(
    (files: readonly File[]) => {
      if (files.length === 0) return;
      const pending = stageKbFilesFromUpload(files);
      setDocuments((prev) => [...prev, ...pending]);
      markDirty();
      for (const doc of pending) {
        runKbDocumentIngest(projectId, doc, setDocuments);
      }
    },
    [projectId, markDirty]
  );

  const removeDocument = React.useCallback(
    (docId: string) => {
      const doc = documents.find((d) => d.id === docId);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      markDirty();
      deleteKbRepositoryBlob(projectId, doc?.repositoryDocumentId);
    },
    [documents, projectId, markDirty]
  );

  const updateDocument = React.useCallback(
    (docId: string, patch: KbDocumentPatch) => {
      setDocuments((prev) => prev.map((d) => (d.id === docId ? { ...d, ...patch } : d)));
      markDirty();
    },
    [markDirty]
  );

  const toPersisted = React.useCallback(() => documents.map(stagedKbToPersisted), [documents]);

  return {
    documents,
    addFiles,
    removeDocument,
    updateDocument,
    toPersisted,
    hydrateFromPersisted,
  };
}
