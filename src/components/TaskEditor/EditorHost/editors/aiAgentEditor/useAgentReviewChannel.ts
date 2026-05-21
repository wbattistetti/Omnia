/**
 * Pubblica / controlla / importa il canale review condiviso per il task agente corrente.
 */

import * as React from 'react';
import type { AIAgentUseCase, AIAgentUseCaseCategory } from '@types/aiAgentUseCases';
import {
  buildAgentReviewDocument,
  summarizeReviewDiff,
  computeReviewContentHashAsync,
  canonicalReviewPayload,
  type AgentReviewChannelDocument,
} from '@domain/agentReviewChannel/reviewDocument';
import { fetchAgentReviewChannel, saveAgentReviewChannel } from '@services/agentReviewChannelApi';

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
  | { kind: 'published'; at: string }
  | { kind: 'imported'; at: string };

export interface UseAgentReviewChannelParams {
  projectId: string | undefined;
  taskInstanceId: string | undefined;
  taskLabel: string;
  designDescription: string;
  useCases: readonly AIAgentUseCase[];
  useCaseCategories: readonly AIAgentUseCaseCategory[];
  setDesignDescription: (value: string) => void;
  setUseCases: React.Dispatch<React.SetStateAction<AIAgentUseCase[]>>;
  setUseCaseCategories: React.Dispatch<React.SetStateAction<AIAgentUseCaseCategory[]>>;
  setDirty: (dirty: boolean) => void;
}

function reviewTokenFromEnv(): string {
  try {
    return String(
      (import.meta.env as Record<string, string | undefined>).VITE_AGENT_REVIEW_CHANNEL_TOKEN ?? ''
    ).trim();
  } catch {
    return '';
  }
}

export function useAgentReviewChannel(params: UseAgentReviewChannelParams) {
  const {
    projectId,
    taskInstanceId,
    taskLabel,
    designDescription,
    useCases,
    useCaseCategories,
    setDesignDescription,
    setUseCases,
    setUseCaseCategories,
    setDirty,
  } = params;

  const [banner, setBanner] = React.useState<ReviewChannelBanner>({ kind: 'idle' });
  const [busy, setBusy] = React.useState(false);

  const canUseChannel = Boolean(projectId?.trim() && taskInstanceId?.trim());

  const buildLocalParams = React.useCallback(
    () => ({
      projectId: projectId!.trim(),
      taskInstanceId: taskInstanceId!.trim(),
      taskLabel,
      agentDesignDescription: designDescription,
      useCases,
      categories: useCaseCategories,
    }),
    [projectId, taskInstanceId, taskLabel, designDescription, useCases, useCaseCategories]
  );

  const publishToChannel = React.useCallback(async () => {
    if (!canUseChannel) {
      setBanner({ kind: 'error', message: 'projectId o task mancante.' });
      return;
    }
    setBusy(true);
    setBanner({ kind: 'loading' });
    try {
      const doc = buildAgentReviewDocument(buildLocalParams());
      const payload = canonicalReviewPayload(doc);
      doc.contentHash = await computeReviewContentHashAsync(payload);
      await saveAgentReviewChannel({
        projectId: projectId!,
        taskInstanceId: taskInstanceId!,
        document: doc,
        token: reviewTokenFromEnv(),
      });
      setBanner({ kind: 'published', at: new Date().toISOString() });
    } catch (e) {
      setBanner({
        kind: 'error',
        message: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setBusy(false);
    }
  }, [canUseChannel, buildLocalParams, projectId, taskInstanceId]);

  const checkChannelUpdate = React.useCallback(async () => {
    if (!canUseChannel) {
      setBanner({ kind: 'error', message: 'projectId o task mancante.' });
      return;
    }
    setBusy(true);
    setBanner({ kind: 'loading' });
    try {
      const { document: remote, updatedAt } = await fetchAgentReviewChannel({
        projectId: projectId!,
        taskInstanceId: taskInstanceId!,
        token: reviewTokenFromEnv(),
      });
      if (!remote) {
        setBanner({ kind: 'error', message: 'Nessun file sul canale. Pubblica da Omnia prima.' });
        return;
      }
      const localDoc = buildAgentReviewDocument(buildLocalParams());
      const localPayload = canonicalReviewPayload(localDoc);
      const localHash = await computeReviewContentHashAsync(localPayload);
      if (localHash === remote.contentHash) {
        setBanner({ kind: 'in_sync', remoteUpdatedAt: updatedAt });
        return;
      }
      const diff = summarizeReviewDiff(buildLocalParams(), remote);
      const parts: string[] = [];
      if (diff.descriptionChanged) parts.push('descrizione');
      if (diff.modifiedScenarioCount > 0) parts.push(`${diff.modifiedScenarioCount} scenario`);
      if (diff.voteChanges > 0) parts.push(`${diff.voteChanges} voti`);
      const summary =
        parts.length > 0 ? `Differenze: ${parts.join(', ')}.` : 'Il canale ha una revisione più recente.';
      setBanner({
        kind: 'update_available',
        remoteUpdatedAt: updatedAt,
        summary,
        remote,
      });
    } catch (e) {
      setBanner({
        kind: 'error',
        message: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setBusy(false);
    }
  }, [canUseChannel, buildLocalParams, projectId, taskInstanceId]);

  const importFromChannel = React.useCallback(async () => {
    if (!canUseChannel) {
      setBanner({ kind: 'error', message: 'projectId o task mancante.' });
      return;
    }
    setBusy(true);
    try {
      let remote: AgentReviewChannelDocument | null =
        banner.kind === 'update_available' ? banner.remote : null;
      if (!remote) {
        const fetched = await fetchAgentReviewChannel({
          projectId: projectId!,
          taskInstanceId: taskInstanceId!,
          token: reviewTokenFromEnv(),
        });
        remote = fetched.document;
      }
      if (!remote) {
        setBanner({ kind: 'error', message: 'Canale vuoto.' });
        return;
      }
      setDesignDescription(remote.agentDesignDescription);
      setUseCases([...remote.useCaseBundle.use_cases]);
      setUseCaseCategories([...remote.useCaseBundle.categories]);
      setDirty(true);
      setBanner({ kind: 'imported', at: new Date().toISOString() });
    } catch (e) {
      setBanner({
        kind: 'error',
        message: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setBusy(false);
    }
  }, [banner, canUseChannel, projectId, taskInstanceId, setDesignDescription, setUseCases, setUseCaseCategories, setDirty]);

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
    publishToChannel,
    checkChannelUpdate,
    importFromChannel,
    reviewPortalUrl,
    dismissBanner: () => setBanner({ kind: 'idle' }),
  };
}

export type UseAgentReviewChannelResult = ReturnType<typeof useAgentReviewChannel>;
