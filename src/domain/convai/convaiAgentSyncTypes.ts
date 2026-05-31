/**
 * Parametri per sync completa agente ConvAI ElevenLabs da Omnia (prompt + tool + KB).
 */

import type { ProjectBackendCatalogBlob } from '@domain/backendCatalog/catalogTypes';
import type { ConversationalRule } from '@domain/conversationalRules/types';
import type { StagedKbDocument } from '@domain/knowledgeBase/kbDocumentTypes';
import type { AgentBehaviorMode } from '@domain/useCaseGeneratorWizard/buildConversationalPrompt';
import type { ConversationalCatalogFormat } from '@domain/useCaseGeneratorWizard/catalogFormat';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import type { Task } from '@types/taskTypes';

export type ConvaiAgentSyncPromptOptions = {
  useCases: readonly AIAgentUseCase[];
  conversationalRules?: readonly ConversationalRule[];
  includeLog?: boolean;
  includeBackendLog?: boolean;
  agentBehavior?: AgentBehaviorMode;
  catalogFormat?: ConversationalCatalogFormat;
  backendCatalog?: ProjectBackendCatalogBlob;
  manualCatalogBackendTaskIds?: readonly string[];
  knowledgeBaseDocuments?: readonly StagedKbDocument[];
};

export type ConvaiAgentSyncParams = ConvaiAgentSyncPromptOptions & {
  agentTask: Task;
  /** Progetto corrente — fetch testo KB dal repository quando l’analisi staged è vuota. */
  projectId?: string;
  /** Crea nuovo agente con questo nome (mutually exclusive con agentId se entrambi valorizzati → new wins). */
  newAgentName?: string;
  /** Aggiorna agente esistente (refresh completo prompt/tool/KB). */
  agentId?: string;
};

export type ConvaiAgentSyncToolResult = {
  backendTaskId: string;
  toolId: string;
  toolName: string;
};

export type ConvaiAgentSyncResult = {
  agentId: string;
  promptCharCount: number;
  tools: ConvaiAgentSyncToolResult[];
  kbDocumentIds: string[];
  /** Documenti Omnia eleggibili considerati per upload. */
  kbCandidateCount: number;
  /** Documenti effettivamente caricati su ElevenLabs. */
  kbUploadedCount: number;
};

export type ConvaiAgentSyncFailurePhase =
  | 'validate'
  | 'create_agent'
  | 'build_prompt'
  | 'build_tool'
  | 'create_tool'
  | 'upload_kb'
  | 'patch_agent';

export type ConvaiAgentSyncFailure = {
  phase: ConvaiAgentSyncFailurePhase;
  message: string;
  compileErrors?: string[];
  backendTaskId?: string;
};
