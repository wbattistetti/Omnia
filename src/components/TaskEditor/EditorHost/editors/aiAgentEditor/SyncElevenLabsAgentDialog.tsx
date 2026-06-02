/**
 * Aggiorna agente ConvAI ElevenLabs: prompt, tool webhook, KB — albero agente + sotto-agenti workflow.
 */

import React from 'react';
import { Bot, Loader2, RefreshCw } from 'lucide-react';
import Modal from '@components/Modal';
import type { ConvaiAgentSyncParams, ConvaiAgentSyncResult } from '@domain/convai/convaiAgentSyncTypes';
import { syncConvaiAgentFromOmnia } from '@services/syncConvaiAgentFromOmnia';
import { collectConvaiWebhookTunnelReadinessForSync } from '@utils/iaAgentRuntime/prepareConvaiWebhookToolForElevenLabsApi';
import { devTunnelMapHasAnyBase } from '@domain/devTunnel/devTunnelCompileBridge';
import { deleteConvaiAgentViaOmniaServer } from '@services/convaiProvisionApi';
import { listConvaiAgentsForWorkspace } from '@workspaces/elevenlabs/api/convaiAgentApi';
import { taskRepository } from '@services/TaskRepository';
import type { Task } from '@types/taskTypes';
import type { IAAgentConfig, IAAgentPlatform } from 'types/iaAgentRuntimeSetup';
import { applyIaPlatformToTaskConfig } from '@utils/iaAgentRuntime/applyIaPlatformToTaskConfig';
import { AGENT_PLATFORM_DISPLAY_LABEL } from '@utils/iaAgentRuntime/globalVoiceByPlatform';
import {
  serializeIaAgentConfigForTaskPersistence,
} from '@utils/iaAgentRuntime/iaAgentConfigNormalize';
import { resolveTaskIaConfig } from '@utils/iaAgentRuntime/resolveTaskIaConfig';
import { saveIaRuntimeOverrideToDb } from '@utils/iaAgentRuntime/saveIaRuntimeOverrideToDb';
import { ConvaiSyncPlatformPicker } from './ConvaiSyncPlatformPicker';
import {
  buildSyncActionLabel,
  ConvaiAgentSyncTreePanel,
  fetchWorkflowNodesForAgent,
  type ConvaiAgentTreeEntry,
  type ConvaiSyncTreeSelection,
} from './ConvaiAgentSyncTreePanel';

export type SyncElevenLabsAgentDialogProps = {
  open: boolean;
  onClose: () => void;
  syncParams: ConvaiAgentSyncParams | null;
  onSynced?: (result: ConvaiAgentSyncResult) => void;
  elevatedOverlay?: boolean;
};

export function SyncElevenLabsAgentDialog({
  open,
  onClose,
  syncParams,
  onSynced,
  elevatedOverlay = false,
}: SyncElevenLabsAgentDialogProps): React.ReactElement {
  const [agents, setAgents] = React.useState<readonly { agentId: string; name: string }[]>([]);
  const [treeEntries, setTreeEntries] = React.useState<
    Record<string, ConvaiAgentTreeEntry | undefined>
  >({});
  const [selection, setSelection] = React.useState<ConvaiSyncTreeSelection | null>(null);
  const [newAgentName, setNewAgentName] = React.useState('');
  const [loadingAgents, setLoadingAgents] = React.useState(false);
  const [deletingAgentId, setDeletingAgentId] = React.useState<string | null>(null);
  const [syncing, setSyncing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [compileErrors, setCompileErrors] = React.useState<string[]>([]);
  /** Webhook tool: gateway Omnia + tunnel ngrok se mappa attiva. */
  const [useDevTunnelForWebhook, setUseDevTunnelForWebhook] = React.useState(true);
  /** Runtime IA effettivo dopo scelta piattaforma nel modale (persistito su task). */
  const [iaConfigEffective, setIaConfigEffective] = React.useState<IAAgentConfig | null>(null);
  const [platformPickBusy, setPlatformPickBusy] = React.useState(false);
  const [platformPickHint, setPlatformPickHint] = React.useState<string | null>(null);

  const resolvedIaConfig = React.useMemo(() => {
    if (!syncParams) return null;
    return iaConfigEffective ?? resolveTaskIaConfig(syncParams.agentTask);
  }, [syncParams, iaConfigEffective]);

  const convaiSyncReady = resolvedIaConfig?.platform === 'elevenlabs';

  const syncParamsForRun = React.useMemo((): ConvaiAgentSyncParams | null => {
    if (!syncParams || !iaConfigEffective) return syncParams;
    const iaJson = serializeIaAgentConfigForTaskPersistence(iaConfigEffective);
    return {
      ...syncParams,
      agentTask: { ...syncParams.agentTask, agentIaRuntimeOverrideJson: iaJson } as Task,
    };
  }, [syncParams, iaConfigEffective]);

  const backendCount =
    syncParams?.manualCatalogBackendTaskIds?.length ??
    syncParams?.backendCatalog?.manualEntries?.length ??
    0;

  const tunnelReadiness = React.useMemo(
    () =>
      syncParamsForRun
        ? collectConvaiWebhookTunnelReadinessForSync({
            ...syncParamsForRun,
            useDevTunnelForWebhook,
          })
        : null,
    [syncParamsForRun, useDevTunnelForWebhook]
  );

  const useNewAgent = newAgentName.trim().length > 0;

  const canSync =
    convaiSyncReady &&
    Boolean(syncParamsForRun) &&
    (useNewAgent || Boolean(selection?.agentId)) &&
    (backendCount === 0 || !useDevTunnelForWebhook || tunnelReadiness?.ready !== false);

  const syncButtonLabel = buildSyncActionLabel(selection, useNewAgent, newAgentName);

  const loadWorkflowForAgent = React.useCallback(async (agentId: string, name: string) => {
    setTreeEntries((prev) => ({
      ...prev,
      [agentId]: {
        agentId,
        name,
        expanded: true,
        loading: true,
        error: null,
        workflowNodes: prev[agentId]?.workflowNodes ?? [],
      },
    }));
    try {
      const workflowNodes = await fetchWorkflowNodesForAgent(agentId);
      setTreeEntries((prev) => ({
        ...prev,
        [agentId]: {
          agentId,
          name,
          expanded: true,
          loading: false,
          error: null,
          workflowNodes,
        },
      }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setTreeEntries((prev) => ({
        ...prev,
        [agentId]: {
          agentId,
          name,
          expanded: true,
          loading: false,
          error: msg,
          workflowNodes: [],
        },
      }));
    }
  }, []);

  const loadAgents = React.useCallback(async () => {
    setLoadingAgents(true);
    setError(null);
    try {
      const page = await listConvaiAgentsForWorkspace({ pageSize: 100 });
      setAgents(page.agents);
      setTreeEntries({});
      if (page.agents.length === 1) {
        const a = page.agents[0];
        const label = a.name?.trim() || a.agentId;
        setSelection({ scope: 'root', agentId: a.agentId, displayName: label });
        void loadWorkflowForAgent(a.agentId, a.name);
      } else {
        setSelection(null);
      }
    } catch (e) {
      setAgents([]);
      setSelection(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingAgents(false);
    }
  }, [loadWorkflowForAgent]);

  const wasOpenRef = React.useRef(false);
  React.useEffect(() => {
    const justOpened = open && !wasOpenRef.current;
    wasOpenRef.current = open;
    if (!justOpened) return;

    setError(null);
    setCompileErrors([]);
    setSyncing(false);
    setNewAgentName('');
    setSelection(null);
    setTreeEntries({});
    setIaConfigEffective(null);
    setPlatformPickHint(null);
    setPlatformPickBusy(false);
    setUseDevTunnelForWebhook(devTunnelMapHasAnyBase());
    void loadAgents();
  }, [open, loadAgents]);

  const handlePlatformSelect = React.useCallback(
    async (platform: IAAgentPlatform) => {
      if (!syncParams) return;
      if (platform !== 'elevenlabs') {
        setPlatformPickHint(
          `Sync ConvAI è disponibile solo con ${AGENT_PLATFORM_DISPLAY_LABEL.elevenlabs}. ` +
            `Hai scelto ${AGENT_PLATFORM_DISPLAY_LABEL[platform]}.`
        );
        return;
      }
      setPlatformPickHint(null);
      setPlatformPickBusy(true);
      setError(null);
      try {
        const current = iaConfigEffective ?? resolveTaskIaConfig(syncParams.agentTask);
        const next = applyIaPlatformToTaskConfig(current, 'elevenlabs');
        setIaConfigEffective(next);

        const pid = String(syncParams.projectId ?? '').trim();
        const tid = String(syncParams.agentTask.id ?? '').trim();
        const iaJson = serializeIaAgentConfigForTaskPersistence(next);
        if (pid && tid) {
          const saved = await saveIaRuntimeOverrideToDb(pid, tid, next);
          if (!saved.ok) {
            setError(saved.error);
          } else {
            taskRepository.updateTask(tid, { agentIaRuntimeOverrideJson: iaJson } as Partial<Task>, pid);
          }
        }
      } finally {
        setPlatformPickBusy(false);
      }
    },
    [syncParams, iaConfigEffective]
  );

  const handleToggleExpand = React.useCallback(
    (agentId: string) => {
      const agent = agents.find((a) => a.agentId === agentId);
      if (!agent) return;
      const entry = treeEntries[agentId];
      const nextExpanded = !(entry?.expanded ?? false);
      setTreeEntries((prev) => ({
        ...prev,
        [agentId]: {
          agentId,
          name: agent.name,
          expanded: nextExpanded,
          loading: entry?.loading ?? false,
          error: entry?.error ?? null,
          workflowNodes: entry?.workflowNodes ?? [],
        },
      }));
      if (nextExpanded && !entry?.workflowNodes.length && !entry?.loading) {
        void loadWorkflowForAgent(agentId, agent.name);
      }
    },
    [agents, loadWorkflowForAgent, treeEntries]
  );

  const handleSync = React.useCallback(async () => {
    if (!syncParamsForRun || !convaiSyncReady) return;
    setSyncing(true);
    setError(null);
    setCompileErrors([]);
    try {
      const trimmedNew = newAgentName.trim();
      const agentId = selection?.agentId ?? '';
      const out = await syncConvaiAgentFromOmnia({
        ...syncParamsForRun,
        useDevTunnelForWebhook,
        ...(trimmedNew ? { newAgentName: trimmedNew } : { agentId }),
        ...(selection?.scope === 'workflow'
          ? {
              syncTargetWorkflowNodeId: selection.nodeId,
              syncTargetWorkflowNodeLabel: selection.nodeLabel,
            }
          : {}),
      });
      if (!out.ok) {
        setError(out.failure.message);
        if (out.failure.compileErrors?.length) {
          setCompileErrors(out.failure.compileErrors);
        }
        return;
      }
      onSynced?.(out.result);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSyncing(false);
    }
  }, [
    convaiSyncReady,
    newAgentName,
    onClose,
    onSynced,
    selection,
    syncParamsForRun,
    useDevTunnelForWebhook,
  ]);

  const handleDeleteAgent = React.useCallback(
    async (agentId: string) => {
      const agent = agents.find((a) => a.agentId === agentId);
      const label = agent?.name?.trim() ? `${agent.name} (${agentId})` : agentId;
      if (
        !window.confirm(
          `Eliminare l’agente ConvAI «${label}» da ElevenLabs?\n\nL’operazione è irreversibile.`
        )
      ) {
        return;
      }
      setDeletingAgentId(agentId);
      setError(null);
      try {
        await deleteConvaiAgentViaOmniaServer(agentId);
        setAgents((prev) => prev.filter((a) => a.agentId !== agentId));
        setTreeEntries((prev) => {
          const next = { ...prev };
          delete next[agentId];
          return next;
        });
        if (selection?.agentId === agentId) setSelection(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setDeletingAgentId(null);
      }
    },
    [agents, selection?.agentId]
  );

  const treeDisabled = syncing || useNewAgent || !syncParamsForRun || !convaiSyncReady;

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="Aggiorna agente ElevenLabs"
      isLoading={syncing}
      overlayClassName={elevatedOverlay ? 'z-[70]' : 'z-50'}
    >
      <div className="space-y-3">
        {!syncParams ? (
          <p className="rounded-lg border border-amber-800/50 bg-amber-950/35 px-3 py-2 text-xs text-amber-100">
            Apri dal task AI Agent (Prompt o tab Backends).
          </p>
        ) : null}

        {syncParams && resolvedIaConfig && !convaiSyncReady ? (
          <ConvaiSyncPlatformPicker
            currentPlatform={resolvedIaConfig.platform}
            onSelect={(p) => void handlePlatformSelect(p)}
            busy={platformPickBusy}
            nonElevenLabsHint={platformPickHint}
          />
        ) : null}

        {syncParams && convaiSyncReady ? (
          <p className="text-[11px] text-slate-500">
            Runtime IA:{' '}
            <span className="text-violet-200">{AGENT_PLATFORM_DISPLAY_LABEL.elevenlabs}</span>
          </p>
        ) : null}

        {syncParams && backendCount > 0 && convaiSyncReady ? (
          <label className="flex cursor-pointer items-start gap-2 rounded-md border border-slate-700/50 bg-slate-900/50 px-2.5 py-2">
            <input
              type="checkbox"
              className="mt-0.5 shrink-0"
              checked={useDevTunnelForWebhook}
              onChange={(e) => setUseDevTunnelForWebhook(e.target.checked)}
              disabled={syncing}
            />
            <span className="text-xs text-slate-300">
              <span className="font-medium text-slate-100">Passa dal gateway Omnia (per logging)</span>
              <span className="mt-0.5 block text-[10px] text-slate-500">
                URL tool via gateway Express; tunnel ngrok se attivo (Impostazioni → Tunnel dev).
              </span>
            </span>
          </label>
        ) : null}

        {syncParams &&
        convaiSyncReady &&
        backendCount > 0 &&
        useDevTunnelForWebhook &&
        tunnelReadiness &&
        !tunnelReadiness.ready ? (
          <p className="rounded-md border border-amber-600/45 bg-amber-950/40 px-2.5 py-2 text-[11px] text-amber-100">
            Tunnel ngrok mancante sulla porta 3100 — attivalo in Impostazioni → Tunnel dev, oppure
            deseleziona il gateway per sync solo prompt/KB.
          </p>
        ) : null}

        {convaiSyncReady ? (
          <>
        <label className="block text-[11px] font-medium text-slate-400">
          Crea nuovo agente
          <input
            type="text"
            value={newAgentName}
            onChange={(e) => setNewAgentName(e.target.value)}
            disabled={syncing || !syncParamsForRun}
            placeholder="Nome nuovo agente ConvAI"
            className="mt-1 w-full rounded-lg border border-violet-500/40 bg-slate-900 px-2.5 py-1.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-violet-400 focus:outline-none disabled:opacity-50"
          />
        </label>

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Agenti e workflow
            </span>
            <button
              type="button"
              onClick={() => void loadAgents()}
              disabled={loadingAgents || syncing || Boolean(deletingAgentId)}
              className="inline-flex items-center gap-1 rounded border border-slate-600 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-800 disabled:opacity-50"
            >
              {loadingAgents ? (
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              ) : (
                <RefreshCw className="h-3 w-3" aria-hidden />
              )}
              Aggiorna elenco
            </button>
          </div>

          {loadingAgents && agents.length === 0 ? (
            <div className="flex min-h-[12rem] items-center justify-center rounded-lg border border-slate-700/50 bg-slate-950/50">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" aria-hidden />
            </div>
          ) : (
            <ConvaiAgentSyncTreePanel
              agents={agents}
              entriesByAgentId={treeEntries}
              selection={useNewAgent ? null : selection}
              onSelectionChange={setSelection}
              onToggleExpand={handleToggleExpand}
              onLoadWorkflow={loadWorkflowForAgent}
              onDeleteAgent={(id) => void handleDeleteAgent(id)}
              disabled={treeDisabled}
              deletingAgentId={deletingAgentId}
            />
          )}

          {selection?.scope === 'workflow' ? (
            <p className="mt-1.5 text-[10px] text-slate-500">
              Sync attuale: prompt/tool/KB sull&apos;agente root; il nodo workflow è il target
              selezionato per il pulsante.
            </p>
          ) : null}
        </div>
          </>
        ) : null}

        {error ? (
          <p className="rounded-md border border-rose-800/55 bg-rose-950/45 px-2.5 py-2 text-xs text-rose-200">
            {error}
          </p>
        ) : null}

        {compileErrors.length > 0 ? (
          <ul className="max-h-28 overflow-y-auto rounded-md border border-amber-800/45 bg-amber-950/30 px-2.5 py-2 text-[11px] text-amber-100">
            {compileErrors.slice(0, 8).map((line) => (
              <li key={line} className="font-mono">
                {line}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="flex justify-end gap-2 border-t border-slate-700/70 pt-3">
          <button
            type="button"
            onClick={onClose}
            disabled={syncing}
            className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50"
          >
            Annulla
          </button>
          <button
            type="button"
            disabled={
              !canSync ||
              syncing ||
              platformPickBusy ||
              loadingAgents ||
              Boolean(deletingAgentId)
            }
            onClick={() => void handleSync()}
            title={syncButtonLabel}
            className="inline-flex max-w-[min(100%,20rem)] items-center gap-2 truncate rounded-lg border border-violet-600/70 bg-violet-950/50 px-3 py-1.5 text-sm font-medium text-violet-100 hover:bg-violet-900/60 disabled:opacity-50"
          >
            {syncing ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
            ) : (
              <Bot className="h-4 w-4 shrink-0" aria-hidden />
            )}
            <span className="truncate">{syncButtonLabel}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** @deprecated Usare {@link SyncElevenLabsAgentDialog}. */
export { SyncElevenLabsAgentDialog as PublishElevenLabsWebhookDialog };
