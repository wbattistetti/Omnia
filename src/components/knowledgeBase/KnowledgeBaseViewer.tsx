/**
 * Shared KB upload UI — delegates to {@link KnowledgeBaseWorkspace}.
 */

import React from 'react';
import type { StagedKbDocument, KbDocumentPatch } from '@domain/knowledgeBase/kbDocumentTypes';
import type { AiCallMeta } from '@services/aiAgentDesignApi';
import { KnowledgeBaseWorkspace } from './KnowledgeBaseWorkspace';

export type KnowledgeBaseViewerProps = {
  documents: readonly StagedKbDocument[];
  projectId?: string;
  callMeta?: AiCallMeta;
  onAddFiles: (files: File[]) => void;
  onRemoveDocument?: (docId: string) => void;
  onUpdateDocument: (docId: string, patch: KbDocumentPatch) => void;
  disabled?: boolean;
  emptyHint?: string;
  footerHint?: string;
  className?: string;
};

export function KnowledgeBaseViewer({
  footerHint: _footerHint,
  ...props
}: KnowledgeBaseViewerProps): React.ReactElement {
  return <KnowledgeBaseWorkspace {...props} />;
}
