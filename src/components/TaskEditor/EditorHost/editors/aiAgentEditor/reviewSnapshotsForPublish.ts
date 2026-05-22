/**
 * Builds review-channel snapshot blocks from Omnia editor state at publish time.
 */

import type { BackendPlaceholderInstance } from '@domain/agentPrompt';
import type { ManualCatalogEntry } from '@domain/backendCatalog';
import { buildProjectBackendCatalogView } from '@domain/backendCatalog';
import type { ConversationStyleSelections } from '@domain/aiAgentConversationStyle/conversationStyleSelections';
import type { ConversationalRule } from '@domain/conversationalRules/types';
import { parseAgentKnowledgeBaseDocumentsJson } from '@domain/knowledgeBase/serializeKbDocuments';
import type {
  AgentReviewBackendSnapshot,
  AgentReviewConversationSnapshot,
  AgentReviewKbDocumentSnapshot,
  AgentReviewKnowledgeBaseSnapshot,
} from '@domain/agentReviewChannel/reviewSnapshots';
import type { Task } from '@types/taskTypes';

export interface ReviewPublishSnapshotParams {
  taskInstanceId: string;
  agentKnowledgeBaseDocumentsJson: string;
  conversationalRules: readonly ConversationalRule[];
  conversationStyleAuto: boolean;
  conversationStyleSelections: ConversationStyleSelections;
  globalStyleId: string;
  styleLearningNotes: string;
  deployStyleId: string | null;
  backendPlaceholders: readonly BackendPlaceholderInstance[];
  projectTasks: readonly Task[];
  manualBackendEntries: readonly ManualCatalogEntry[];
}

function kbDocumentsFromJson(json: string): AgentReviewKnowledgeBaseSnapshot | undefined {
  const docs = parseAgentKnowledgeBaseDocumentsJson(json);
  if (docs.length === 0) return undefined;
  const documents: AgentReviewKbDocumentSnapshot[] = docs.map((d) => ({
    id: d.id,
    name: d.name,
    size: d.size,
    mimeType: d.mimeType,
    addedAt: d.addedAt,
    parseStatus: d.parseStatus,
    ...(d.parseError ? { parseError: d.parseError } : {}),
    ...(d.format ? { format: d.format } : {}),
    ...(d.howToUseText?.trim() ? { howToUseText: d.howToUseText } : {}),
    ...(d.markdownSnippet?.trim() ? { markdownSnippet: d.markdownSnippet } : {}),
    ...(d.repositoryDocumentId ? { repositoryDocumentId: d.repositoryDocumentId } : {}),
    ...(d.dataTypes?.length ? { dataTypes: [...d.dataTypes] } : {}),
  }));
  return { documents };
}

function backendSnapshotFromProject(
  taskInstanceId: string,
  projectTasks: readonly Task[],
  manualBackendEntries: readonly ManualCatalogEntry[],
  backendPlaceholders: readonly BackendPlaceholderInstance[]
): AgentReviewBackendSnapshot | undefined {
  const tid = taskInstanceId.trim();
  const { rows } = buildProjectBackendCatalogView([...projectTasks], [...manualBackendEntries]);
  const catalogRows = rows
    .map((row) => ({
      key: row.key,
      label: row.label,
      method: row.method,
      pathnameDisplay: row.pathnameDisplay,
      sources: { ...row.sources },
      bindings: row.bindings
        .filter((b) => b.taskId === tid)
        .map((b) => ({
          bindingId: b.bindingId,
          source: b.source,
          method: b.method,
          endpointUrl: b.endpointUrl,
        })),
    }))
    .filter((row) => row.bindings.length > 0);

  const structuredPlaceholders = backendPlaceholders
    .filter((p) => p.id.trim() && p.definitionId.trim())
    .map((p) => ({ id: p.id.trim(), definitionId: p.definitionId.trim() }));

  if (catalogRows.length === 0 && structuredPlaceholders.length === 0) return undefined;
  return { catalogRows, structuredPlaceholders };
}

function conversationSnapshotFromState(params: {
  conversationalRules: readonly ConversationalRule[];
  conversationStyleAuto: boolean;
  conversationStyleSelections: ConversationStyleSelections;
  globalStyleId: string;
  styleLearningNotes: string;
  deployStyleId: string | null;
}): AgentReviewConversationSnapshot | undefined {
  const conversationalRules = params.conversationalRules.map((r) => ({
    id: r.id,
    libraryRuleId: r.libraryRuleId,
    label: r.label,
    scenario: r.scenario,
    exampleMessage: r.exampleMessage,
    sort_order: r.sort_order,
    ...(r.enabled === false ? { enabled: false } : {}),
  }));
  const styleSelections: AgentReviewConversationSnapshot['styleSelections'] = {};
  for (const [styleId, entry] of Object.entries(params.conversationStyleSelections)) {
    styleSelections[styleId] = {
      checked: Boolean(entry.checked),
      description: entry.description ?? '',
      example: entry.example ?? '',
    };
  }
  const hasContent =
    conversationalRules.length > 0 ||
    Object.keys(styleSelections).length > 0 ||
    params.conversationStyleAuto ||
    params.globalStyleId.trim() !== '' ||
    params.styleLearningNotes.trim() !== '' ||
    params.deployStyleId != null;
  if (!hasContent) return undefined;
  return {
    conversationalRules,
    styleAuto: params.conversationStyleAuto,
    styleSelections,
    globalStyleId: params.globalStyleId,
    styleLearningNotes: params.styleLearningNotes,
    deployStyleId: params.deployStyleId,
  };
}

/** Full snapshot of KB, backend, and conversation state for review publish. */
export function buildReviewPublishSnapshots(
  params: ReviewPublishSnapshotParams
): {
  knowledgeBase?: AgentReviewKnowledgeBaseSnapshot;
  backends?: AgentReviewBackendSnapshot;
  conversation?: AgentReviewConversationSnapshot;
} {
  return {
    knowledgeBase: kbDocumentsFromJson(params.agentKnowledgeBaseDocumentsJson),
    backends: backendSnapshotFromProject(
      params.taskInstanceId,
      params.projectTasks,
      params.manualBackendEntries,
      params.backendPlaceholders
    ),
    conversation: conversationSnapshotFromState(params),
  };
}
