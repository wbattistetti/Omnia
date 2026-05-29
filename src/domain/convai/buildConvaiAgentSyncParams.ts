/**
 * Costruisce {@link ConvaiAgentSyncParams} dal dock AI Agent o dal task agente.
 */

import type { ProjectBackendCatalogBlob } from '@domain/backendCatalog/catalogTypes';
import type { ConvaiAgentSyncParams } from '@domain/convai/convaiAgentSyncTypes';
import type { ConversationalRule } from '@domain/conversationalRules/types';
import type { StagedKbDocument } from '@domain/knowledgeBase/kbDocumentTypes';
import type { AgentBehaviorMode } from '@domain/useCaseGeneratorWizard/buildConversationalPrompt';
import type { ConversationalCatalogFormat } from '@domain/useCaseGeneratorWizard/catalogFormat';
import { parseAgentUseCasesJson } from '@types/aiAgentUseCases';
import { TaskType, type Task } from '@types/taskTypes';
import { taskRepository } from '@services/TaskRepository';

export type BuildConvaiAgentSyncParamsInput = {
  agentTaskId: string;
  projectId?: string;
  backendCatalog?: ProjectBackendCatalogBlob;
  manualCatalogBackendTaskIds?: readonly string[];
  knowledgeBaseDocuments?: readonly StagedKbDocument[];
  useCases?: readonly import('@types/aiAgentUseCases').AIAgentUseCase[];
  conversationalRules?: readonly ConversationalRule[];
  includeLog?: boolean;
  agentBehavior?: AgentBehaviorMode;
  catalogFormat?: ConversationalCatalogFormat;
  newAgentName?: string;
  agentId?: string;
};

/** Risolve task AI Agent e parametri sync; null se task mancante o tipo errato. */
export function buildConvaiAgentSyncParams(
  input: BuildConvaiAgentSyncParamsInput
): ConvaiAgentSyncParams | null {
  const agentTaskId = String(input.agentTaskId ?? '').trim();
  if (!agentTaskId) return null;
  const agentTask = taskRepository.getTask(agentTaskId);
  if (!agentTask || agentTask.type !== TaskType.AIAgent) return null;

  const useCases =
    input.useCases ??
    parseAgentUseCasesJson(String(agentTask.agentUseCasesJson ?? ''));

  return {
    agentTask,
    projectId: String(input.projectId ?? '').trim() || undefined,
    useCases,
    conversationalRules: input.conversationalRules,
    includeLog: input.includeLog,
    agentBehavior: input.agentBehavior,
    catalogFormat: input.catalogFormat,
    backendCatalog: input.backendCatalog,
    manualCatalogBackendTaskIds: input.manualCatalogBackendTaskIds,
    knowledgeBaseDocuments: input.knowledgeBaseDocuments,
    newAgentName: input.newAgentName,
    agentId: input.agentId,
  };
}
