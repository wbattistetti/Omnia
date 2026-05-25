/**
 * Shared KB upload UI — delegates to {@link KnowledgeBaseWorkspace}.
 */

import React from 'react';
import type { StagedKbDocument, KbDocumentPatch } from '@domain/knowledgeBase/kbDocumentTypes';
import type { AiCallMeta } from '@services/aiAgentDesignApi';
import type { KbDocumentAnalysisTaskContext } from '@domain/knowledgeBase/kbDocumentAnalysisApi';
import { KnowledgeBaseWorkspace } from './KnowledgeBaseWorkspace';

export type KnowledgeBaseViewerProps = {
  documents: readonly StagedKbDocument[];
  projectId?: string;
  callMeta?: AiCallMeta;
  taskContext?: KbDocumentAnalysisTaskContext;
  onAddFiles: (files: File[]) => void;
  onRemoveDocument?: (docId: string) => void;
  onReorderDocuments?: (next: readonly StagedKbDocument[]) => void;
  onUpdateDocument: (docId: string, patch: KbDocumentPatch) => void;
  disabled?: boolean;
  emptyHint?: string;
  footerHint?: string;
  className?: string;
  tutorDocumentListId?: string;
  tutorAnalysisResultId?: string;
  hideWorkspaceHeader?: boolean;
  onRegisterAddDocumentPicker?: (open: () => void) => void | (() => void);
};

export function KnowledgeBaseViewer({
  footerHint: _footerHint,
  ...props
}: KnowledgeBaseViewerProps): React.ReactElement {
  return <KnowledgeBaseWorkspace {...props} />;
}
