/**
 * Provider condiviso per revisione sezioni Monaco (tab Analisi + sheet L1 parametro).
 */

import React from 'react';
import { useAIProvider } from '@context/AIProviderContext';
import type { AiCallMeta } from '@services/aiAgentDesignApi';
import { taskRepository } from '@services/TaskRepository';
import { buildBackendReferenceCorpus } from '@domain/backendAnalysis/buildBackendReferenceCorpus';
import type { ManualCatalogEntry, ProjectBackendCatalogBlob } from '@domain/backendCatalog/catalogTypes';
import type { KbDocumentAnalysisTaskContext } from '@domain/knowledgeBase/kbDocumentAnalysisApi';
import type { StagedKbDocument } from '@domain/knowledgeBase/kbDocumentTypes';
import { BackendAnalysisEditProvider } from './BackendAnalysisEditContext';

function buildKbContextMarkdown(documents: readonly StagedKbDocument[]): string {
  const blocks: string[] = [];
  for (const doc of documents) {
    const text = String(doc.documentAnalysisMarkdown ?? doc.markdownSnippet ?? '').trim();
    if (!text) continue;
    blocks.push(`### ${doc.name}\n${text.slice(0, 6_000)}`);
  }
  return blocks.join('\n\n');
}

export type BackendAnalysisEditScopeProps = {
  projectId: string | undefined;
  agentTaskId: string;
  manualEntries: readonly ManualCatalogEntry[];
  backendCatalog: ProjectBackendCatalogBlob;
  onPersistCatalog: (next: ProjectBackendCatalogBlob) => void;
  taskContext?: KbDocumentAnalysisTaskContext;
  kbDocuments?: readonly StagedKbDocument[];
  callMeta?: AiCallMeta;
  disabled?: boolean;
  children: React.ReactNode;
};

/** Contesto edit/revisione backend analysis per tab e overlay L1. */
export function BackendAnalysisEditScope({
  projectId,
  agentTaskId,
  manualEntries,
  backendCatalog,
  onPersistCatalog,
  taskContext,
  kbDocuments = [],
  callMeta,
  disabled = false,
  children,
}: BackendAnalysisEditScopeProps): React.ReactElement {
  const { provider, model } = useAIProvider();

  const referenceCorpus = React.useMemo(() => {
    const tasks = taskRepository.getAllTasks();
    return buildBackendReferenceCorpus({
      manualEntries,
      tasks,
      agentTaskSummary: taskContext?.agentTaskSummary,
      kbContextMarkdown: buildKbContextMarkdown(kbDocuments),
    });
  }, [manualEntries, taskContext?.agentTaskSummary, kbDocuments]);

  return (
    <BackendAnalysisEditProvider
      projectId={projectId}
      agentTaskId={agentTaskId}
      manualEntries={manualEntries}
      backendCatalog={backendCatalog}
      onPersistCatalog={onPersistCatalog}
      referenceCorpus={referenceCorpus}
      kbContextMarkdown={buildKbContextMarkdown(kbDocuments)}
      taskContext={taskContext}
      provider={provider}
      model={model}
      callMeta={callMeta}
      disabled={disabled}
    >
      {children}
    </BackendAnalysisEditProvider>
  );
}
