/**
 * Pre-compile ConvAI ElevenLabs: ogni Run elimina agenti con `__GUID_{taskId}` + crea un agente nuovo
 * (nome `OMNIA_<client>_<progetto>_<versione>_…__GUID_<taskId>`), dopo validazione tool backend.
 * `agent_id` resta solo in {@link convaiSessionAgentStore} (non nel DB).
 */

import type { Node } from 'reactflow';
import type { FlowNode } from '../Flowchart/types/flowTypes';
import { enrichRowsWithTaskId } from '../../utils/taskHelpers';
import { taskRepository } from '../../services/TaskRepository';
import { TaskType } from '../../types/taskTypes';
import {
  CreateConvaiAgentHttpError,
  createConvaiAgentViaOmniaServer,
  deleteConvaiAgentViaOmniaServer,
  listAllConvaiAgentsMatchingTaskGuid,
} from '../../services/convaiProvisionApi';
import {
  buildConvaiProvisionKey,
  conversationConfigForConvaiApi,
  conversationConfigFragmentFromIaAgentConfig,
} from '../../utils/iaAgentRuntime/convaiAgentCreatePayload';
import { buildConvaiAgentDisplayName } from '../../utils/iaAgentRuntime/convaiAgentDisplayName';
import { iaAgentConfigWithEditorSystemPrompt } from '../../utils/iaAgentRuntime/iaAgentConfigWithEditorSystemPrompt';
import { resolveTaskIaConfig } from '../../utils/iaAgentRuntime/resolveTaskIaConfig';
import {
  mergeResolvedAndLiveIaConfig,
  peekConvaiLiveIaConfig,
} from '../../utils/iaAgentRuntime/convaiLiveIaConfigBridge';
import { setConvaiSessionBinding } from '../../utils/iaAgentRuntime/convaiSessionAgentStore';
import type { NormalizedIaProviderError } from '@domain/compileErrors/iaProviderErrors';
import { normalizeProviderError } from '@domain/compileErrors/normalizeProviderError';
import { setIaProvisioningError } from '@domain/compileErrors/iaProvisioningErrorStore';
import { buildUseCaseDialoguesPreviewFromTask } from '@utils/iaAgentRuntime/agentUseCasesProvisionPreviewFormat';
import {
  emitConvaiProvisionPayloadPreview,
  isConvaiPayloadPreviewOnRunDebugEnabled,
  type ConvaiProvisionPayloadPreviewItem,
} from '@utils/iaAgentRuntime/convaiPayloadPreviewEvents';
import { mergeConvaiBackendToolIdLists } from '@domain/iaAgentTools/manualCatalogBackendToolIds';
import { collectReachableBackendCallTaskIdsFromFlow } from '@domain/iaAgentTools/collectReachableBackendCallTaskIdsFromFlow';

/** Contesto per il nome leggibile ElevenLabs (OMNIA… + GUID) e validazione tool. */
export type ConvaiProvisionContext = {
  projectLabel: string;
  rootFlowLabel: string;
  /** taskId → etichetta nodo canvas */
  nodeLabelByTaskId: Record<string, string>;
  /** Allinea payload/tool alla tab Backends (`backendCatalog.manualEntries`). */
  manualCatalogBackendTaskIds?: readonly string[];
  /** ProjectData.clientName / ownerClient — prefisso deterministico agent name. */
  omniaClientLabel?: string;
  /** ProjectData.version */
  omniaVersionLabel?: string;
  /** Grafo corrente per reachability Backend Call vs lista tool vuota. */
  flowSlice?: { nodes: unknown[]; edges: unknown[] };
};

/**
 * Se `false`, `conversation_config.tts` (voice_id + model_id) è incluso nel create quando la runtime
 * ha una voce primaria — allineato alla UI Agent setup. Su alcuni cluster EU un voice_id non valido
 * può causare 422 da ElevenLabs; in quel caso verificare voce/catalogo o residency.
 */
const OMIT_TTS_ON_CREATE = false;

/**
 * Per ogni task AI Agent ElevenLabs sul canvas: sempre DELETE mirato su `__GUID_{taskId}` + CREATE
 * (nessuno skip per provision key: ogni Run crea un agente nuovo allineato ai backend correnti).
 */
export async function ensureConvaiAgentsProvisioned(
  nodes: Node<FlowNode>[],
  context: ConvaiProvisionContext
): Promise<{
  provisioned: string[];
  skipped: string[];
  failed: string[];
}> {
  const enriched = nodes.map((node) => ({
    ...node,
    data: { ...node.data, rows: enrichRowsWithTaskId(node.data?.rows || []) },
  }));

  const seen = new Set<string>();
  const provisioned: string[] = [];
  const skipped: string[] = [];
  const failed: string[] = [];

  const projectSlug = String(context.projectLabel || 'project').trim() || 'project';
  const flowSlug = String(context.rootFlowLabel || 'flow').trim() || 'flow';
  const payloadPreviewItems: ConvaiProvisionPayloadPreviewItem[] = [];

  for (const node of enriched) {
    const rows = node.data?.rows || [];
    for (const row of rows) {
      const taskId = String(row.id || row.taskId || '').trim();
      if (!taskId || seen.has(taskId)) continue;
      seen.add(taskId);

      const task = taskRepository.getTask(taskId);
      if (!task || task.type !== TaskType.AIAgent) continue;

      const resolved = resolveTaskIaConfig(task);
      const live = peekConvaiLiveIaConfig(taskId);
      const cfg = mergeResolvedAndLiveIaConfig(resolved, live);
      if (cfg.platform !== 'elevenlabs') continue;

      const manualCatalogBackendTaskIds = context.manualCatalogBackendTaskIds ?? [];
      const cfgForCreate = iaAgentConfigWithEditorSystemPrompt(cfg, task, {
        manualCatalogBackendTaskIds,
      });
      let provisionKey: string;
      try {
        provisionKey = buildConvaiProvisionKey(cfgForCreate, task, OMIT_TTS_ON_CREATE, {
          manualCatalogBackendTaskIds,
        });
      } catch {
        failed.push(taskId);
        setIaProvisioningError(taskId, {
          provider: 'elevenlabs',
          code: 'provisionKey',
          message: 'ConvAI: prompt vuoto o runtime non valido per il task.',
          raw: null,
        });
        continue;
      }
      if (!provisionKey) {
        failed.push(taskId);
        setIaProvisioningError(taskId, {
          provider: 'elevenlabs',
          code: 'provisionKey',
          message: 'ConvAI: impossibile calcolare la chiave di provision.',
          raw: null,
        });
        continue;
      }

      const fromCfg = (cfgForCreate.convaiBackendToolTaskIds ?? [])
        .map((x) => String(x || '').trim())
        .filter(Boolean);
      const effectiveBackendIds = mergeConvaiBackendToolIdLists(fromCfg, [...manualCatalogBackendTaskIds]);
      let backendToolValidationFailed = false;
      for (const bid of effectiveBackendIds) {
        const bt = taskRepository.getTask(bid);
        if (!bt || bt.type !== TaskType.BackendCall) {
          failed.push(taskId);
          setIaProvisioningError(taskId, {
            provider: 'elevenlabs',
            code: 'backendToolTaskMissing',
            message: `ConvAI: id tool backend «${bid.slice(0, 8)}…» non trovato nel progetto o non è un Backend Call.`,
            raw: { bid },
          });
          backendToolValidationFailed = true;
          break;
        }
      }
      if (backendToolValidationFailed) continue;

      const reachableBackendIds = collectReachableBackendCallTaskIdsFromFlow(
        context.flowSlice ?? null,
        taskId
      );
      if (reachableBackendIds.length > 0 && effectiveBackendIds.length === 0) {
        failed.push(taskId);
        setIaProvisioningError(taskId, {
          provider: 'elevenlabs',
          code: 'convaiBackendToolIdsEmpty',
          message:
            'ConvAI: nessun tool backend in elenco (`convaiBackendToolTaskIds` / catalogo) ma il flusso ha Backend Call raggiungibili dall’agente.',
          raw: null,
        });
        continue;
      }

      const nodeLabel =
        context.nodeLabelByTaskId[taskId] ||
        String(node.data?.label || node.data?.text || 'node').trim() ||
        'node';

      let displayName: string;
      try {
        displayName = buildConvaiAgentDisplayName({
          projectLabel: projectSlug,
          flowLabel: flowSlug,
          nodeLabel,
          taskGuid: taskId,
          omniaClientLabel: context.omniaClientLabel,
          omniaVersionLabel: context.omniaVersionLabel,
        });
      } catch (e) {
        failed.push(taskId);
        setIaProvisioningError(taskId, {
          provider: 'elevenlabs',
          code: 'displayName',
          message: e instanceof Error ? e.message : String(e),
          raw: e,
        });
        continue;
      }

      let fragment: Record<string, unknown>;
      try {
        fragment = conversationConfigFragmentFromIaAgentConfig(cfgForCreate, {
          omitTts: OMIT_TTS_ON_CREATE,
          task,
          manualCatalogBackendTaskIds,
        })!;
      } catch (buildErr) {
        failed.push(taskId);
        setIaProvisioningError(taskId, {
          provider: 'elevenlabs',
          code: 'conversationConfig',
          message: buildErr instanceof Error ? buildErr.message : String(buildErr),
          raw: buildErr,
        });
        continue;
      }

      const conversationConfigOutbound =
        conversationConfigForConvaiApi(fragment) ?? fragment;

      let previewEntry: ConvaiProvisionPayloadPreviewItem | undefined;
      try {
        const matches = await listAllConvaiAgentsMatchingTaskGuid(taskId);
        for (const m of matches) {
          try {
            await deleteConvaiAgentViaOmniaServer(m.agentId);
          } catch (delErr) {
            console.warn('[IA·ConvAI] delete agent (cleanup) failed, continue', {
              taskId,
              agentId: m.agentId,
              error: delErr instanceof Error ? delErr.message : String(delErr),
            });
          }
        }

        {
          const requestBody: Record<string, unknown> = {};
          const n = displayName.trim();
          if (n) requestBody.name = n;
          requestBody.conversation_config = conversationConfigOutbound;
          previewEntry = {
            taskId,
            displayName,
            bodyText: JSON.stringify(requestBody, null, 2),
            useCaseDialoguesPreview: buildUseCaseDialoguesPreviewFromTask(task),
          };
          payloadPreviewItems.push(previewEntry);
        }
        const result = await createConvaiAgentViaOmniaServer({
          name: displayName,
          conversation_config: conversationConfigOutbound,
        });
        if (previewEntry && result.elevenLabsRequestJson?.trim()) {
          previewEntry.bodyText = result.elevenLabsRequestJson.trim();
        }

        setConvaiSessionBinding(taskId, result.agentId, provisionKey);
        provisioned.push(taskId);
        setIaProvisioningError(taskId, null);
      } catch (err) {
        if (
          previewEntry &&
          err instanceof CreateConvaiAgentHttpError &&
          err.elevenLabsRequestJson?.trim()
        ) {
          previewEntry.bodyText = err.elevenLabsRequestJson.trim();
        }
        failed.push(taskId);
        const normalized: NormalizedIaProviderError =
          normalizeProviderError(err) ?? {
            provider: 'unknown',
            code: 'raw',
            message: err instanceof Error ? err.message : String(err),
            raw: err,
          };
        setIaProvisioningError(taskId, normalized);
        console.error('[IA·ConvAI] provision failed', {
          taskId,
          error: err instanceof Error ? err.message : String(err),
          normalized,
        });
      }
    }
  }

  if (payloadPreviewItems.length > 0) {
    emitConvaiProvisionPayloadPreview(payloadPreviewItems);
  } else if (isConvaiPayloadPreviewOnRunDebugEnabled()) {
    emitConvaiProvisionPayloadPreview([
      {
        taskId: 'convai-preview-no-elevenlabs-tasks',
        displayName: 'ConvAI — nessun task da provisionare',
        bodyText:
          '// Debug Run: nessun task AI Agent con piattaforma ElevenLabs nel flusso passato a ensureConvaiAgentsProvisioned.\n' +
          '// Il pannello è mostrato in sviluppo (import.meta.env.DEV) o con localStorage omnia.debug.convaiPayloadOnRun=1.\n' +
          '// Per non aprirlo in dev: localStorage.setItem("omnia.debug.convaiPayloadOnRun", "0").',
      },
    ]);
  }

  return { provisioned, skipped, failed };
}
