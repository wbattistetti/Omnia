/**
 * Dock panel: per-task runtime IA settings (Response Editor). Tab title is "Agent setup"; panel stays compact (badge + save).
 */

import React from 'react';
import type { IDockviewPanelProps } from 'dockview';
import { IAAgentSetup } from '@components/settings/IAAgentSetup';
import { loadGlobalIaAgentConfig } from '@utils/iaAgentRuntime/globalIaAgentPersistence';
import { refreshIaCatalog } from '@services/iaCatalogApi';
import { createConvaiAgentViaOmniaServer } from '@services/convaiProvisionApi';
import { conversationConfigFragmentFromIaAgentConfig } from '@utils/iaAgentRuntime/convaiAgentCreatePayload';
import { iaAgentConfigWithEditorSystemPrompt } from '@utils/iaAgentRuntime/iaAgentConfigWithEditorSystemPrompt';
import { resolveTaskIaConfig } from '@utils/iaAgentRuntime/resolveTaskIaConfig';
import { taskRepository } from '@services/TaskRepository';
import { useAIAgentEditorDock } from './AIAgentEditorDockContext';

export function EditorIaRuntimePanel(_props: IDockviewPanelProps) {
  const {
    instanceId,
    iaRuntimeConfig,
    setIaRuntimeConfig,
    iaRuntimeLoadedFrom,
    saveIaRuntimeOverrideToTask,
    persistIaRuntimeOverrideSnapshot,
  } = useAIAgentEditorDock();
  const baseline = React.useMemo(() => loadGlobalIaAgentConfig(), []);
  const [catalogBusy, setCatalogBusy] = React.useState(false);
  const [catalogMsg, setCatalogMsg] = React.useState<string | null>(null);
  const [catalogReloadNonce, setCatalogReloadNonce] = React.useState(0);

  const loadedTitle =
    iaRuntimeLoadedFrom === 'saved_override'
      ? 'Parametri persistiti sul task (override).'
      : 'Default globali (Impostazioni → Runtime IA Agent); Salva per creare override sul task.';

  React.useEffect(() => {
    console.log('[IA·ConvAI] DIAG UI panel mount', {
      instanceId,
      valid: !!instanceId,
    });
  }, [instanceId]);

  React.useEffect(() => {
    const scopeId = String(instanceId ?? '').trim();
    const onApplyTts = (ev: Event) => {
      const e = ev as CustomEvent<{ ttsModel?: string; taskInstanceId?: string }>;
      const model = typeof e.detail?.ttsModel === 'string' ? e.detail.ttsModel.trim() : '';
      if (!model || !scopeId) return;
      const tid = String(e.detail?.taskInstanceId ?? '').trim();
      if (!tid || tid !== scopeId) return;
      persistIaRuntimeOverrideSnapshot({
        ttsModel: model,
        elevenLabsNeedsReprovision: true,
      });
      document.dispatchEvent(
        new CustomEvent('omnia:ia-runtime-focus', {
          bubbles: true,
          detail: { taskInstanceId: scopeId, focus: 'ttsModel' as const },
        })
      );
    };
    document.addEventListener('omnia:convai-apply-tts-model', onApplyTts);
    return () => document.removeEventListener('omnia:convai-apply-tts-model', onApplyTts);
  }, [instanceId, persistIaRuntimeOverrideSnapshot]);

  React.useEffect(() => {
    const onFocus = (ev: Event) => {
      const e = ev as CustomEvent<{ taskInstanceId?: string; focus?: string }>;
      const id = String(e.detail?.taskInstanceId ?? '').trim();
      const focus = String(e.detail?.focus ?? '').trim() as
        | 'voice'
        | 'language'
        | 'llm'
        | 'agentId'
        | 'catalog'
        | 'systemPrompt'
        | 'model'
        | 'maxTokens'
        | 'endpoint'
        | 'apiKey'
        | 'safety'
        | 'ttsModel';
      if (!id || id !== String(instanceId ?? '').trim()) return;
      if (!focus) return;
      let attempt = 0;
      const tryScroll = () => {
        attempt += 1;
        const el = document.querySelector(`[data-ia-runtime-focus="${focus}"]`);
        if (el instanceof HTMLElement) {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          el.classList.add('navigation-step-flash');
          window.setTimeout(() => el.classList.remove('navigation-step-flash'), 450);
          return;
        }
        if (attempt < 40) {
          window.setTimeout(tryScroll, 55);
        }
      };
      window.setTimeout(tryScroll, 80);
    };
    document.addEventListener('omnia:ia-runtime-focus', onFocus);
    return () => document.removeEventListener('omnia:ia-runtime-focus', onFocus);
  }, [instanceId]);

  const handleProvisionConvaiAgent = React.useCallback(async () => {
    const currentIaConfig = iaRuntimeConfig;

    if (currentIaConfig.convaiAgentId?.trim()) {
      console.log('[IA·ConvAI] DIAG UI persist NOT called', {
        taskId: instanceId,
        reason: 'agentId missing, invalid, or early return',
      });
      return;
    }

    try {
      const task = instanceId ? taskRepository.getTask(instanceId) : null;
      const cfgForCreate = iaAgentConfigWithEditorSystemPrompt(
        task ? resolveTaskIaConfig(task) : iaRuntimeConfig,
        task
      );
      const fragment = conversationConfigFragmentFromIaAgentConfig(cfgForCreate);
      const { agentId } = await createConvaiAgentViaOmniaServer({
        name: `Omnia · ${instanceId ?? 'task'}`,
        ...(fragment ? { conversation_config: fragment } : {}),
      });

      console.log('[IA·ConvAI] DIAG UI createAgent response', {
        taskId: instanceId,
        agentIdReceived: agentId,
        type: typeof agentId,
        isEmpty:
          !agentId || (typeof agentId === 'string' && agentId.trim().length === 0),
      });

      console.log('[IA·ConvAI] DIAG UI pre-persist check', {
        taskId: instanceId,
        agentId,
        hasExistingConvaiAgentId: !!currentIaConfig?.convaiAgentId,
      });

      if (!agentId || String(agentId).trim().length === 0) {
        console.log('[IA·ConvAI] DIAG UI persist NOT called', {
          taskId: instanceId,
          reason: 'agentId missing, invalid, or early return',
        });
        return;
      }

      console.log('[IA·ConvAI] DIAG UI calling persist', {
        taskId: instanceId,
        partial: { platform: 'elevenlabs', convaiAgentId: agentId },
      });
      const persistPartial: Parameters<typeof persistIaRuntimeOverrideSnapshot>[0] = {
        platform: 'elevenlabs',
        convaiAgentId: agentId,
        elevenLabsNeedsReprovision: false,
      };
      if (cfgForCreate.systemPrompt.trim().length > 0) {
        persistPartial.systemPrompt = cfgForCreate.systemPrompt;
      }
      persistIaRuntimeOverrideSnapshot(persistPartial);
    } catch (err) {
      console.error('[IA·ConvAI] DIAG UI createAgent error', {
        taskId: instanceId,
        error: err,
      });
    }
  }, [iaRuntimeConfig, instanceId, persistIaRuntimeOverrideSnapshot]);

  return (
    <div className="h-full min-h-0 overflow-y-auto space-y-1 bg-violet-950/15 p-1.5 border-l-4 border-violet-500/45">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          className={
            iaRuntimeLoadedFrom === 'saved_override'
              ? 'rounded border border-violet-500/50 bg-violet-950/80 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-violet-200'
              : 'rounded border border-slate-600/80 bg-slate-950/60 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-slate-400'
          }
          title={loadedTitle}
        >
          {iaRuntimeLoadedFrom === 'saved_override' ? 'Override' : 'Globali'}
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            data-ia-runtime-focus="catalog"
            disabled={catalogBusy}
            onClick={async () => {
              setCatalogBusy(true);
              setCatalogMsg(null);
              try {
                await refreshIaCatalog();
                setCatalogReloadNonce((n) => n + 1);
                setCatalogMsg('Catalogo aggiornato.');
              } catch (e) {
                setCatalogMsg(String(e instanceof Error ? e.message : e));
              } finally {
                setCatalogBusy(false);
              }
            }}
            className="shrink-0 rounded-md border border-slate-500/80 bg-slate-900 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-800 disabled:opacity-50"
            title="Sincronizza voci, lingue e modelli (server)"
          >
            {catalogBusy ? '…' : 'Aggiorna catalogo'}
          </button>
          <button
            type="button"
            onClick={() => saveIaRuntimeOverrideToTask()}
            className="shrink-0 rounded-md bg-violet-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-violet-500"
          >
            Salva override
          </button>
        </div>
      </div>
      {catalogMsg ? <p className="text-[10px] text-slate-400">{catalogMsg}</p> : null}
      <IAAgentSetup
        mode="override"
        defaultConfig={baseline}
        value={iaRuntimeConfig}
        onChange={setIaRuntimeConfig}
        catalogReloadNonce={catalogReloadNonce}
        onProvisionConvaiAgent={handleProvisionConvaiAgent}
      />
    </div>
  );
}
