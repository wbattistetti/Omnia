/**
 * Prompt esterno unificato: use case + USE OF BACKENDS + knowledge base (tab dialog «Copia tutto»).
 */

import type { ProjectBackendCatalogBlob } from '@domain/backendCatalog/catalogTypes';
import { buildUseOfBackendsPromptSection } from '@domain/backendAnalysis/buildUseOfBackendsPromptSection';
import type { StagedKbDocument } from '@domain/knowledgeBase/kbDocumentTypes';
import {
  buildConversationalPrompt,
  type BuildConversationalPromptOptions,
} from '@domain/useCaseGeneratorWizard/buildConversationalPrompt';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import type { AgentStartPromptConfig } from '@domain/useCaseGeneratorWizard/agentStartPrompt';
import { buildKbRuntimePromptSection } from './buildKbRuntimePromptSection';

export type ExternalAgentPromptTabId = 'use-cases' | 'backends' | 'knowledge-base';

export type ExternalAgentPromptSections = {
  useCases: string;
  backends: string;
  knowledgeBase: string;
};

const SECTION_SEPARATOR = '\n\n---\n\n';

export type BuildExternalAgentPromptSectionsParams = BuildConversationalPromptOptions & {
  useCases: readonly AIAgentUseCase[];
  startPrompt?: AgentStartPromptConfig;
  startUseCaseId?: string;
  agentTaskId?: string;
  backendCatalog?: ProjectBackendCatalogBlob;
  manualCatalogBackendTaskIds?: readonly string[];
  knowledgeBaseDocuments?: readonly StagedKbDocument[];
};

/** Costruisce i tre blocchi tab (use case, backend, KB) in modo deterministico. */
export function buildExternalAgentPromptSections(
  params: BuildExternalAgentPromptSectionsParams
): ExternalAgentPromptSections {
  const useCases = buildConversationalPrompt(params.useCases, {
    ...params,
    startPrompt: params.startPrompt,
    startUseCaseId: params.startUseCaseId,
    includeBackendLog: params.includeBackendLog,
  });
  const agentTaskId = String(params.agentTaskId ?? '').trim();
  const backends = agentTaskId
    ? buildUseOfBackendsPromptSection({
        catalog: params.backendCatalog,
        agentTaskId,
        manualCatalogBackendTaskIds: params.manualCatalogBackendTaskIds,
      })
    : '';
  const knowledgeBase = buildKbRuntimePromptSection(params.knowledgeBaseDocuments ?? []);
  return { useCases, backends, knowledgeBase };
}

/** Unisce i blocchi non vuoti per «Copia tutto» (ordine: use case → backend → KB). */
export function mergeExternalAgentPromptSections(sections: ExternalAgentPromptSections): string {
  const parts = [sections.useCases, sections.backends, sections.knowledgeBase]
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return '';
  return `${parts.join(SECTION_SEPARATOR)}\n`;
}

export function externalAgentPromptSectionForTab(
  sections: ExternalAgentPromptSections,
  tab: ExternalAgentPromptTabId
): string {
  switch (tab) {
    case 'use-cases':
      return sections.useCases;
    case 'backends':
      return sections.backends;
    case 'knowledge-base':
      return sections.knowledgeBase;
    default:
      return '';
  }
}

export function emptyExternalPromptPlaceholder(tab: ExternalAgentPromptTabId): string {
  switch (tab) {
    case 'use-cases':
      return '(Use case non disponibili: compila il catalogo prima di copiare.)';
    case 'backends':
      return '(Nessuna sezione USE OF BACKENDS.\nRecupera le specifiche OpenAPI e usa «Analizza» nella tab Backends, poi salva il progetto.)';
    case 'knowledge-base':
      return '(Nessuna sintesi knowledge base.\nCarica documenti nella tab Knowledge base ed esegui l’analisi.)';
    default:
      return '';
  }
}
