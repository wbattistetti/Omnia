/**
 * Pubblica / controlla / importa il canale review condiviso per il task agente corrente.
 */

import * as React from 'react';
import type {
  AIAgentLogicalStep,
  AIAgentUseCase,
  AIAgentUseCaseCategory,
} from '@types/aiAgentUseCases';
import type { AgentReviewAudience } from '@domain/agentReviewChannel/reviewAudience';
import { REVIEW_PUBLISH_AUDIENCES } from '@domain/agentReviewChannel/reviewAudience';
import {
  buildAgentReviewDocument,
  computeReviewContentHashAsync,
  canonicalReviewPayload,
  type AgentReviewChannelDocument,
  type AgentReviewStructuredSections,
  type BuildReviewDocumentParams,
} from '@domain/agentReviewChannel/reviewDocument';
import {
  fetchAgentReviewChannel,
  saveAgentReviewChannel,
  subscribeReviewChannelEvents,
  REVIEW_CHANNEL_POLL_MS,
} from '@services/agentReviewChannelApi';
import {
  fetchReviewAudiencePendingStatus,
  hasAnyPendingImport,
  reviewAudienceStatusesSignature,
  type ReviewAudiencePendingStatus,
} from './reviewChannelPending';
import { isExpressBackendPaused } from '@services/expressBackendReachability';
import { reviewChannelClientToken } from '@lib/reviewChannelClientToken';
import { structuredSectionsForReviewPublish } from './structuredSectionsForReviewPublish';
import { buildReviewPublishSnapshots } from './reviewSnapshotsForPublish';
import type { ManualCatalogEntry } from '@domain/backendCatalog';
import type { BackendPlaceholderInstance } from '@domain/agentPrompt';
import type { ConversationStyleSelections } from '@domain/aiAgentConversationStyle/conversationStyleSelections';
import type { ConversationalRule } from '@domain/conversationalRules/types';
import type { Task } from '@types/taskTypes';
import type { AgentReviewDesignerLlmSnapshot } from '@domain/agentReviewChannel/reviewDocument';
import { useDocumentVisible } from '@hooks/useDocumentVisible';

export type ReviewChannelBanner =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | {
      kind: 'update_available';
      remoteUpdatedAt: string | null;
      summary: string;
      remote: AgentReviewChannelDocument;
    }
  | { kind: 'in_sync'; remoteUpdatedAt: string | null }
  | { kind: 'published'; at: string; audience: AgentReviewAudience }
  | { kind: 'imported'; at: string };

export interface UseAgentReviewChannelParams {
  projectId: string | undefined;
  taskInstanceId: string | undefined;
  taskLabel: string;
  designDescription: string;
  useCases: readonly AIAgentUseCase[];
  useCaseCategories: readonly AIAgentUseCaseCategory[];
  logicalSteps?: readonly AIAgentLogicalStep[];
  agentStructuredSectionsJson?: string;
  agentPrompt?: string;
  setDesignDescription: (value: string) => void;
  setUseCases: React.Dispatch<React.SetStateAction<AIAgentUseCase[]>>;
  setUseCaseCategories: React.Dispatch<React.SetStateAction<AIAgentUseCaseCategory[]>>;
  setDirty: (dirty: boolean) => void;
  importReviewStructuredSections?: (sections: AgentReviewStructuredSections) => void;
  agentKnowledgeBaseDocumentsJson?: string;
  conversationalRules?: readonly ConversationalRule[];
  conversationStyleAuto?: boolean;
  conversationStyleSelections?: ConversationStyleSelections;
  globalStyleId?: string;
  styleLearningNotes?: string;
  deployStyleId?: string | null;
  backendPlaceholders?: readonly BackendPlaceholderInstance[];
  projectTasks?: readonly Task[];
  manualBackendEntries?: readonly ManualCatalogEntry[];
  /** Modello LLM designer attivo in Omnia (incluso nel publish verso il portale). */
  designerLlm?: AgentReviewDesignerLlmSnapshot | null;
  /** Stato wizard use case (allineato a `Task.agentUseCaseWizardStateJson`). */
  agentUseCaseWizardStateJson?: string;
}

function buildReviewLocalParams(p: UseAgentReviewChannelParams): BuildReviewDocumentParams {
  const taskInstanceId = String(p.taskInstanceId ?? '').trim();
  const snapshots = buildReviewPublishSnapshots({
    taskInstanceId,
    agentKnowledgeBaseDocumentsJson: p.agentKnowledgeBaseDocumentsJson ?? '',
    conversationalRules: p.conversationalRules ?? [],
    conversationStyleAuto: p.conversationStyleAuto ?? false,
    conversationStyleSelections: p.conversationStyleSelections ?? {},
    globalStyleId: p.globalStyleId ?? '',
    styleLearningNotes: p.styleLearningNotes ?? '',
    deployStyleId: p.deployStyleId ?? null,
    backendPlaceholders: p.backendPlaceholders ?? [],
    projectTasks: p.projectTasks ?? [],
    manualBackendEntries: p.manualBackendEntries ?? [],
  });
  return {
    projectId: String(p.projectId ?? '').trim(),
    taskInstanceId,
    taskLabel: p.taskLabel,
    agentDesignDescription: p.designDescription,
    useCases: p.useCases,
    categories: p.useCaseCategories,
    logicalSteps: p.logicalSteps ?? [],
    structuredSections: structuredSectionsForReviewPublish(
      p.agentStructuredSectionsJson ?? '',
      p.agentPrompt ?? ''
    ),
    ...snapshots,
    ...(p.designerLlm?.model?.trim() ? { designerLlm: p.designerLlm } : {}),
  };
}

const SSE_CHECK_DEBOUNCE_MS = 2_000;

export function useAgentReviewChannel(params: UseAgentReviewChannelParams) {
  const {
    projectId,
    taskInstanceId,
    setDesignDescription,
    setUseCases,
    setUseCaseCategories,
    setDirty,
    importReviewStructuredSections,
  } = params;

  const documentVisible = useDocumentVisible();
  const paramsRef = React.useRef(params);
  paramsRef.current = params;

  const [banner, setBanner] = React.useState<ReviewChannelBanner>({ kind: 'idle' });
  const [busy, setBusy] = React.useState(false);
  const [pendingStatuses, setPendingStatuses] = React.useState<ReviewAudiencePendingStatus[]>([]);
  const pendingSignatureRef = React.useRef('');

  const canUseChannel = Boolean(projectId?.trim() && taskInstanceId?.trim());
  const channelKey = canUseChannel ? `${projectId!.trim()}:${taskInstanceId!.trim()}` : '';

  const buildLocalParams = React.useCallback(
    () => buildReviewLocalParams(paramsRef.current),
    []
  );

  const applyPendingResults = React.useCallback((results: ReviewAudiencePendingStatus[]) => {
    const sig = reviewAudienceStatusesSignature(results);
    if (sig === pendingSignatureRef.current) return;
    pendingSignatureRef.current = sig;
    setPendingStatuses(results);
  }, []);

  const checkAllReviewChannels = React.useCallback(async () => {
    if (!canUseChannel) return [];
    if (isExpressBackendPaused()) return [];
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return [];
    const token = reviewChannelClientToken();
    const local = buildLocalParams();
    const pid = projectId!;
    const tid = taskInstanceId!;
    const results = await Promise.all(
      REVIEW_PUBLISH_AUDIENCES.map((audience) =>
        fetchReviewAudiencePendingStatus(audience, local, pid, tid, token)
      )
    );
    applyPendingResults(results);
    return results;
  }, [canUseChannel, buildLocalParams, projectId, taskInstanceId, applyPendingResults]);

  const checkRef = React.useRef(checkAllReviewChannels);
  checkRef.current = checkAllReviewChannels;

  const publishToChannel = React.useCallback(
    async (audience: AgentReviewAudience) => {
      if (!canUseChannel) {
        setBanner({ kind: 'error', message: 'projectId o task mancante.' });
        return;
      }
      setBusy(true);
      setBanner({ kind: 'loading' });
      try {
        const doc = buildAgentReviewDocument({
          ...buildLocalParams(),
          reviewAudience: audience,
        });
        const payload = canonicalReviewPayload(doc);
        doc.contentHash = await computeReviewContentHashAsync(payload);
        await saveAgentReviewChannel({
          projectId: projectId!,
          taskInstanceId: taskInstanceId!,
          document: doc,
          audience,
          token: reviewChannelClientToken(),
        });
        setBanner({ kind: 'published', at: new Date().toISOString(), audience });
        await checkAllReviewChannels();
      } catch (e) {
        setBanner({
          kind: 'error',
          message: e instanceof Error ? e.message : String(e),
        });
      } finally {
        setBusy(false);
      }
    },
    [canUseChannel, buildLocalParams, projectId, taskInstanceId, checkAllReviewChannels]
  );

  const importFromAudience = React.useCallback(
    async (audience: AgentReviewAudience) => {
      if (!canUseChannel) {
        setBanner({ kind: 'error', message: 'projectId o task mancante.' });
        return;
      }
      setBusy(true);
      try {
        let remote: AgentReviewChannelDocument | null =
          pendingStatuses.find((s) => s.audience === audience)?.remote ?? null;
        if (!remote) {
          const fetched = await fetchAgentReviewChannel({
            projectId: projectId!,
            taskInstanceId: taskInstanceId!,
            audience,
            token: reviewChannelClientToken(),
          });
          remote = fetched.document;
        }
        if (!remote) {
          setBanner({ kind: 'error', message: 'Nessuna review da importare per questo canale.' });
          return;
        }
        setDesignDescription(remote.agentDesignDescription);
        setUseCases([...remote.useCaseBundle.use_cases]);
        setUseCaseCategories([...remote.useCaseBundle.categories]);
        if (remote.agentStructuredSections && importReviewStructuredSections) {
          importReviewStructuredSections(remote.agentStructuredSections);
        }
        setDirty(true);
        setBanner({ kind: 'imported', at: new Date().toISOString() });
        await checkAllReviewChannels();
      } catch (e) {
        setBanner({
          kind: 'error',
          message: e instanceof Error ? e.message : String(e),
        });
      } finally {
        setBusy(false);
      }
    },
    [
      canUseChannel,
      pendingStatuses,
      projectId,
      taskInstanceId,
      setDesignDescription,
      setUseCases,
      setUseCaseCategories,
      setDirty,
      importReviewStructuredSections,
      checkAllReviewChannels,
    ]
  );

  const anyPendingImport = hasAnyPendingImport(pendingStatuses);

  /** Check iniziale + poll lento; dipendenze stabili (no reset su ogni edit use case). */
  React.useEffect(() => {
    if (!canUseChannel || !documentVisible) {
      if (!canUseChannel) {
        pendingSignatureRef.current = '';
        setPendingStatuses([]);
      }
      return;
    }
    void checkRef.current();
    const id = window.setInterval(() => {
      void checkRef.current();
    }, REVIEW_CHANNEL_POLL_MS);
    return () => window.clearInterval(id);
  }, [canUseChannel, channelKey, documentVisible]);

  /** SSE: una sola connessione per task; check debounced per evitare raffiche GET. */
  React.useEffect(() => {
    if (!canUseChannel) return;
    const token = reviewChannelClientToken();
    let debounceId = 0;
    return subscribeReviewChannelEvents({
      projectId: projectId!,
      taskInstanceId: taskInstanceId!,
      token,
      onUpdate: () => {
        window.clearTimeout(debounceId);
        debounceId = window.setTimeout(() => {
          void checkRef.current();
        }, SSE_CHECK_DEBOUNCE_MS);
      },
    });
  }, [canUseChannel, channelKey]);

  /** Home portale (elenco review); deep link opzionale dopo Pubblica. */
  const reviewPortalUrl = React.useMemo(() => {
    const base = String(
      (import.meta.env as Record<string, string | undefined>).VITE_USE_CASE_REVIEW_PORTAL_URL ?? ''
    ).trim();
    if (!base) return null;
    return base.replace(/\/$/, '') + '/';
  }, []);

  return {
    canUseChannel,
    busy,
    banner,
    pendingStatuses,
    anyPendingImport,
    publishToChannel,
    checkAllReviewChannels,
    importFromAudience,
    reviewPortalUrl,
    dismissBanner: () => setBanner({ kind: 'idle' }),
  };
}

export type UseAgentReviewChannelResult = ReturnType<typeof useAgentReviewChannel>;
