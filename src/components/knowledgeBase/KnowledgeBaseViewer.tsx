/**
 * Shared KB upload UI — delegates to {@link KnowledgeBaseWorkspace}.
 */

import React from 'react';
import type { StagedKbDocument, KbDocumentPatch } from '@domain/knowledgeBase/kbDocumentTypes';
import type { AiCallMeta } from '@services/aiAgentDesignApi';
import type { KbSemanticTaskContext } from '@services/kbSemanticAnalysisApi';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import { KnowledgeBaseWorkspace } from './KnowledgeBaseWorkspace';

export type KnowledgeBaseViewerProps = {
  documents: readonly StagedKbDocument[];
  projectId?: string;
  callMeta?: AiCallMeta;
  taskContext?: KbSemanticTaskContext;
  existingUseCaseCount?: number;
  onMergePromotedUseCases?: (useCases: AIAgentUseCase[]) => void;
  existingBundleUseCases?: readonly AIAgentUseCase[];
  regeneratePromotedUseCase?: (skeleton: AIAgentUseCase) => Promise<AIAgentUseCase | null>;
  onAddFiles: (files: File[]) => void;
  onRemoveDocument?: (docId: string) => void;
  onReorderDocuments?: (next: readonly StagedKbDocument[]) => void;
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
