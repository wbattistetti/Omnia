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
  type ReviewAudiencePendingStatus,
} from './reviewChannelPending';
import { reviewChannelClientToken } from '@lib/reviewChannelClientToken';
import { structuredSectionsForReviewPublish } from './structuredSectionsForReviewPublish';
import { buildReviewPublishSnapshots } from './reviewSnapshotsForPublish';
import type { ManualCatalogEntry } from '@domain/backendCatalog';
import type { BackendPlaceholderInstance } from '@domain/agentPrompt';
import type { ConversationStyleSelections } from '@domain/aiAgentConversationStyle/conversationStyleSelections';
import type { ConversationalRule } from '@domain/conversationalRules/types';
import type { Task } from '@types/taskTypes';

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
}

export function useAgentReviewChannel(params: UseAgentReviewChannelParams) {
  const {
    projectId,
    taskInstanceId,
    taskLabel,
    designDescription,
    useCases,
    useCaseCategories,
    logicalSteps = [],
    agentStructuredSectionsJson = '',
    agentPrompt = '',
    setDesignDescription,
    setUseCases,
    setUseCaseCategories,
    setDirty,
    importReviewStructuredSections,
    agentKnowledgeBaseDocumentsJson = '',
    conversationalRules = [],
    conversationStyleAuto = false,
    conversationStyleSelections = {},
    globalStyleId = '',
    styleLearningNotes = '',
    deployStyleId = null,
    backendPlaceholders = [],
    projectTasks = [],
    manualBackendEntries = [],
  } = params;

  const [banner, setBanner] = React.useState<ReviewChannelBanner>({ kind: 'idle' });
  const [busy, setBusy] = React.useState(false);
  const [pendingStatuses, setPendingStatuses] = React.useState<ReviewAudiencePendingStatus[]>([]);

  const canUseChannel = Boolean(projectId?.trim() && taskInstanceId?.trim());

  const buildLocalParams = React.useCallback(
    () => {
      const snapshots = buildReviewPublishSnapshots({
        taskInstanceId: taskInstanceId!.trim(),
        agentKnowledgeBaseDocumentsJson,
        conversationalRules,
        conversationStyleAuto,
        conversationStyleSelections,
        globalStyleId,
        styleLearningNotes,
        deployStyleId,
        backendPlaceholders,
        projectTasks,
        manualBackendEntries,
      });
      return {
        projectId: projectId!.trim(),
        taskInstanceId: taskInstanceId!.trim(),
        taskLabel,
        agentDesignDescription: designDescription,
        useCases,
        categories: useCaseCategories,
        logicalSteps,
        structuredSections: structuredSectionsForReviewPublish(
          agentStructuredSectionsJson,
          agentPrompt
        ),
        ...snapshots,
      };
    },
    [
      projectId,
      taskInstanceId,
      taskLabel,
      designDescription,
      useCases,
      useCaseCategories,
      logicalSteps,
      agentStructuredSectionsJson,
      agentPrompt,
      agentKnowledgeBaseDocumentsJson,
      conversationalRules,
      conversationStyleAuto,
      conversationStyleSelections,
      globalStyleId,
      styleLearningNotes,
      deployStyleId,
      backendPlaceholders,
      projectTasks,
      manualBackendEntries,
    ]
  );

  const checkAllReviewChannels = React.useCallback(async () => {
    if (!canUseChannel) return [];
    const token = reviewChannelClientToken();
    const local = buildLocalParams();
    const pid = projectId!;
    const tid = taskInstanceId!;
    const results = await Promise.all(
      REVIEW_PUBLISH_AUDIENCES.map((audience) =>
        fetchReviewAudiencePendingStatus(audience, local, pid, tid, token)
      )
    );
    setPendingStatuses(results);
    return results;
  }, [canUseChannel, buildLocalParams, projectId, taskInstanceId]);

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

  React.useEffect(() => {
    if (!canUseChannel) {
      setPendingStatuses([]);
      return;
    }
    const t = window.setTimeout(() => {
      void checkAllReviewChannels();
    }, 400);
    return () => clearTimeout(t);
  }, [canUseChannel, projectId, taskInstanceId, checkAllReviewChannels]);

  /** Poll di backup (editor aperto). */
  React.useEffect(() => {
    if (!canUseChannel) return;
    const id = window.setInterval(() => {
      void checkAllReviewChannels();
    }, REVIEW_CHANNEL_POLL_MS);
    return () => clearInterval(id);
  }, [canUseChannel, projectId, taskInstanceId, checkAllReviewChannels]);

  /** SSE: push da PUT Omnia o POST .../notify (portale Bolt). */
  React.useEffect(() => {
    if (!canUseChannel) return;
    const token = reviewChannelClientToken();
    return subscribeReviewChannelEvents({
      projectId: projectId!,
      taskInstanceId: taskInstanceId!,
      token,
      onUpdate: () => {
        void checkAllReviewChannels();
      },
    });
  }, [canUseChannel, projectId, taskInstanceId, checkAllReviewChannels]);

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
