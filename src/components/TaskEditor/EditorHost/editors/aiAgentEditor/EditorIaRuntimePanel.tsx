/**
 * Dock panel: per-task runtime IA settings (Response Editor).
 * Tab title is "Agent setup"; contains an explicit Save button that writes
 * `agentIaRuntimeOverrideJson` directly to Mongo so the selection survives
 * without a full project save.
 */

import React from 'react';
import type { IDockviewPanelProps } from 'dockview';
import { IAAgentSetup } from '@components/settings/IAAgentSetup';
import { loadGlobalIaAgentConfig } from '@utils/iaAgentRuntime/globalIaAgentPersistence';
import { saveIaRuntimeOverrideToDb } from '@utils/iaAgentRuntime/saveIaRuntimeOverrideToDb';
import {
  CreateConvaiAgentHttpError,
  createConvaiAgentViaOmniaServer,
  deleteConvaiAgentViaOmniaServer,
  listAllConvaiAgentsMatchingTaskGuid,
} from '@services/convaiProvisionApi';
import { emitConvaiProvisionPayloadPreview } from '@utils/iaAgentRuntime/convaiPayloadPreviewEvents';
import {
  buildConvaiProvisionKey,
  conversationConfigFragmentFromIaAgentConfig,
} from '@utils/iaAgentRuntime/convaiAgentCreatePayload';
import { buildConvaiAgentDisplayName } from '@utils/iaAgentRuntime/convaiAgentDisplayName';
import { setConvaiSessionBinding } from '@utils/iaAgentRuntime/convaiSessionAgentStore';
import { iaAgentConfigWithEditorSystemPrompt } from '@utils/iaAgentRuntime/iaAgentConfigWithEditorSystemPrompt';
import { resolveTaskIaConfig } from '@utils/iaAgentRuntime/resolveTaskIaConfig';
import { mergeResolvedAndLiveIaConfig } from '@utils/iaAgentRuntime/convaiLiveIaConfigBridge';
import { mergeEffectiveIaAgentTools } from '@domain/iaAgentTools/backendToolDerivation';
import { extractManualCatalogBackendTaskIdsFromProjectData } from '@domain/iaAgentTools/manualCatalogBackendToolIds';
import { taskRepository } from '@services/TaskRepository';
import { useProjectData } from '@context/ProjectDataContext';
import { useAIAgentEditorDock } from './AIAgentEditorDockContext';

type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

export function EditorIaRuntimePanel(_props: IDockviewPanelProps) {
  void _props;
  const {
    instanceId,
    projectId,
    iaRuntimeConfig,
    setIaRuntimeConfig,
    persistIaRuntimeOverrideSnapshot,
  } = useAIAgentEditorDock();
  const { data: projectData } = useProjectData();
  const manualCatalogBackendTaskIds = React.useMemo(
    () => extractManualCatalogBackendTaskIdsFromProjectData(projectData),
    [projectData]
  );
  const baseline = React.useMemo(() => loadGlobalIaAgentConfig(), []);

  const [saveStatus, setSaveStatus] = React.useState<SaveStatus>('idle');
  const [saveError, setSaveError] = React.useState<string | null>(null);

  const handleChange = React.useCallback(
    (next: Parameters<typeof setIaRuntimeConfig>[0]) => {
      setIaRuntimeConfig(next);
      persistIaRuntimeOverrideSnapshot(next);
      setSaveStatus('dirty');
      setSaveError(null);
    },
    [setIaRuntimeConfig, persistIaRuntimeOverrideSnapshot]
  );

  const handleSave = React.useCallback(async () => {
    if (!projectId || !instanceId) {
      setSaveError('projectId o taskId mancanti');
      setSaveStatus('error');
      return;
    }
    setSaveStatus('saving');
    setSaveError(null);
    const result = await saveIaRuntimeOverrideToDb(projectId, instanceId, iaRuntimeConfig);
    if (result.ok) {
      setSaveStatus('saved');
    } else {
      setSaveStatus('error');
      setSaveError(result.error);
    }
  }, [projectId, instanceId, iaRuntimeConfig]);

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
        | 'ttsModel'
        | 'tools';
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
    if (!instanceId?.trim()) return;
    let displayNameForPreview = '';
    let fragmentForPreview: Record<string, unknown> | undefined;
    try {
      const task = taskRepository.getTask(instanceId);
      /** Preferisci lo stato del pannello: evita payload senza `tools` se il repo non è ancora allineato al tick React. */
      const resolved = task ? resolveTaskIaConfig(task) : iaRuntimeConfig;
      const cfgMerged = mergeResolvedAndLiveIaConfig(resolved, iaRuntimeConfig);
      const cfgForCreate = iaAgentConfigWithEditorSystemPrompt(cfgMerged, task, {
        manualCatalogBackendTaskIds,
      });
      const effectiveTools = mergeEffectiveIaAgentTools(cfgForCreate, (id) => taskRepository.getTask(id), {
        manualCatalogBackendTaskIds,
      });
      let fragment: Record<string, unknown>;
      try {
        fragment = conversationConfigFragmentFromIaAgentConfig(cfgForCreate, {
          task: task ?? undefined,
          manualCatalogBackendTaskIds,
        })!;
      } catch (buildErr) {
        console.error('[IA·ConvAI] createAgent: payload non costruibile (prompt vuoto o dati mancanti)', buildErr);
        return;
      }
      fragmentForPreview = fragment;
      const agentPrompt = (fragment.agent as Record<string, unknown> | undefined)?.prompt as
        | Record<string, unknown>
        | undefined;
      const toolsInFragment = Array.isArray(agentPrompt?.tools) ? (agentPrompt.tools as unknown[]).length : 0;
      console.info('[IA·ConvAI] provision merge', {
        taskId: instanceId,
        convaiBackendToolTaskIds: cfgForCreate.convaiBackendToolTaskIds ?? [],
        manualToolsCount: Array.isArray(cfgForCreate.tools) ? cfgForCreate.tools.length : 0,
        effectiveToolsCount: effectiveTools.length,
        effectiveToolNames: effectiveTools.map((x) => x.name),
        toolsInConversationConfig: toolsInFragment,
      });
      if (toolsInFragment === 0 && (cfgForCreate.convaiBackendToolTaskIds?.length ?? 0) > 0) {
        console.warn(
          '[IA·ConvAI] convaiBackendToolTaskIds valorizzati ma nessun tool nel payload: controlla label, backendToolDescription e tipo Backend Call su ogni id.'
        );
      }
      console.info(
        '[IA·ConvAI] conversation_config (post-merge, JSON completo)',
        JSON.stringify({ conversation_config: fragment }, null, 2)
      );
      const provisionKey = buildConvaiProvisionKey(cfgForCreate, task ?? undefined, false, {
        manualCatalogBackendTaskIds,
      });
      const matches = await listAllConvaiAgentsMatchingTaskGuid(instanceId);
      for (const m of matches) {
        console.warn('[DEBUG] DELETE AGENT', m.agentId, { name: m.name });
        try {
          await deleteConvaiAgentViaOmniaServer(m.agentId);
        } catch {
          /* continua la pulizia */
        }
      }
      const displayName = buildConvaiAgentDisplayName({
        projectLabel: 'omnia',
        flowLabel: 'editor',
        nodeLabel: 'ia-runtime',
        taskGuid: instanceId,
      });
      displayNameForPreview = displayName;
      console.warn('[DEBUG] CREATE AGENT PAYLOAD (UI)', JSON.stringify({ name: displayName, conversation_config: fragment }, null, 2));
      const result = await createConvaiAgentViaOmniaServer({
        name: displayName,
        conversation_config: fragment,
      });
      const fallbackPreview = JSON.stringify(
        { name: displayName, conversation_config: fragment },
        null,
        2
      );
      const bodyText = result.elevenLabsRequestJson?.trim() || fallbackPreview;
      emitConvaiProvisionPayloadPreview([{ taskId: instanceId, displayName, bodyText }]);
      const { agentId } = result;
      console.warn('[DEBUG] NEW AGENT ID (UI)', agentId);
      setConvaiSessionBinding(instanceId, agentId, provisionKey);
      const persistPartial: Parameters<typeof persistIaRuntimeOverrideSnapshot>[0] = {
        platform: 'elevenlabs',
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
      let bodyText: string;
      if (err instanceof CreateConvaiAgentHttpError && err.elevenLabsRequestJson?.trim()) {
        bodyText = err.elevenLabsRequestJson.trim();
      } else if (fragmentForPreview && displayNameForPreview) {
        bodyText = JSON.stringify(
          { name: displayNameForPreview, conversation_config: fragmentForPreview },
          null,
          2
        );
      } else {
        bodyText =
          `// Errore prima di un payload completo\n${err instanceof Error ? err.message : String(err)}`;
      }
      emitConvaiProvisionPayloadPreview([
        {
          taskId: instanceId,
          displayName: displayNameForPreview || instanceId,
          bodyText,
        },
      ]);
    }
  }, [iaRuntimeConfig, instanceId, persistIaRuntimeOverrideSnapshot, manualCatalogBackendTaskIds]);

  const saveBtnLabel =
    saveStatus === 'saving' ? 'Salvataggio…' : 'Salva';
  const saveBtnClass =
    saveStatus === 'error'
      ? 'bg-red-700 hover:bg-red-600'
      : saveStatus === 'saved'
        ? 'bg-emerald-700 hover:bg-emerald-600'
        : 'bg-violet-600 hover:bg-violet-500';

  return (
    <div className="h-full min-h-0 overflow-y-auto space-y-1 bg-violet-950/15 p-1.5 border-l-4 border-violet-500/45">
      <div className="flex items-center justify-between gap-2 pb-0.5">
        <span
          className={
            saveStatus === 'saved'
              ? 'text-[10px] font-semibold text-emerald-400'
              : saveStatus === 'error'
                ? 'text-[10px] font-semibold text-red-400'
                : saveStatus === 'dirty'
                  ? 'text-[10px] font-semibold text-amber-400'
                  : 'text-[10px] text-slate-500'
          }
        >
          {saveStatus === 'saved'
            ? '✓ Salvato su DB'
            : saveStatus === 'error'
              ? `✗ ${saveError ?? 'Errore'}`
              : saveStatus === 'dirty'
                ? '● Modifiche non salvate'
                : 'Agent setup'}
        </span>
        <button
          type="button"
          disabled={saveStatus === 'saving' || !projectId || !instanceId}
          onClick={() => void handleSave()}
          className={`shrink-0 rounded-md px-2.5 py-1 text-[11px] font-medium text-white disabled:opacity-50 transition-colors ${saveBtnClass}`}
          title={projectId && instanceId ? 'Salva configurazione IA su DB' : 'projectId o instanceId mancanti'}
        >
          {saveBtnLabel}
        </button>
      </div>
      <IAAgentSetup
        mode="override"
        defaultConfig={baseline}
        value={iaRuntimeConfig}
        onChange={handleChange}
        onProvisionConvaiAgent={handleProvisionConvaiAgent}
      />
    </div>
  );
}
