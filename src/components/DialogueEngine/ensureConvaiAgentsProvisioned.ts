/**
 * Pre-compile ConvAI ElevenLabs: allinea agenti cloud al task tramite nome `__GUID_{taskId}`.
 * `agent_id` resta solo in {@link convaiSessionAgentStore} (non nel DB).
 */

import type { Node } from 'reactflow';
import type { FlowNode } from '../Flowchart/types/flowTypes';
import { enrichRowsWithTaskId } from '../../utils/taskHelpers';
import { taskRepository } from '../../services/TaskRepository';
import { TaskType } from '../../types/taskTypes';
import type { Task } from '../../types/taskTypes';
import {
  CreateConvaiAgentHttpError,
  createConvaiAgentViaOmniaServer,
  deleteConvaiAgentViaOmniaServer,
  listAllConvaiAgentsMatchingTaskGuid,
} from '../../services/convaiProvisionApi';
import {
  buildConvaiProvisionKey,
  conversationConfigFragmentFromIaAgentConfig,
} from '../../utils/iaAgentRuntime/convaiAgentCreatePayload';
import { buildConvaiAgentDisplayName } from '../../utils/iaAgentRuntime/convaiAgentDisplayName';
import { iaAgentConfigWithEditorSystemPrompt } from '../../utils/iaAgentRuntime/iaAgentConfigWithEditorSystemPrompt';
import { resolveTaskIaConfig } from '../../utils/iaAgentRuntime/resolveTaskIaConfig';
import {
  getConvaiSessionBinding,
  setConvaiSessionBinding,
} from '../../utils/iaAgentRuntime/convaiSessionAgentStore';
import type { NormalizedIaProviderError } from '@domain/compileErrors/iaProviderErrors';
import { normalizeProviderError } from '@domain/compileErrors/normalizeProviderError';
import { setIaProvisioningError } from '@domain/compileErrors/iaProvisioningErrorStore';
import {
  emitConvaiProvisionPayloadPreview,
  isConvaiPayloadPreviewOnRunDebugEnabled,
  type ConvaiProvisionPayloadPreviewItem,
} from '@utils/iaAgentRuntime/convaiPayloadPreviewEvents';

/** Contesto per il nome leggibile ElevenLabs (slug + GUID). */
export type ConvaiProvisionContext = {
  projectLabel: string;
  rootFlowLabel: string;
  /** taskId → etichetta nodo canvas */
  nodeLabelByTaskId: Record<string, string>;
};

/**
 * Se `false`, `conversation_config.tts` (voice_id + model_id) è incluso nel create quando la runtime
 * ha una voce primaria — allineato alla UI Agent setup. Su alcuni cluster EU un voice_id non valido
 * può causare 422 da ElevenLabs; in quel caso verificare voce/catalogo o residency.
 */
const OMIT_TTS_ON_CREATE = false;

/**
 * Per ogni task AI Agent ElevenLabs sul canvas: se la chiave di provision in sessione coincide con
 * quella attuale, skip; altrimenti DELETE mirato su `__GUID_{taskId}` + CREATE + aggiornamento sessione.
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

      const cfg = resolveTaskIaConfig(task);
      if (cfg.platform !== 'elevenlabs') continue;

      const cfgForCreate = iaAgentConfigWithEditorSystemPrompt(cfg, task);
      let provisionKey: string;
      try {
        provisionKey = buildConvaiProvisionKey(cfgForCreate, task, OMIT_TTS_ON_CREATE);
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

      const session = getConvaiSessionBinding(taskId);
      if (session && session.lastProvisionKey === provisionKey && session.agentId.trim().length > 0) {
        const previewBody: Record<string, unknown> = {};
        const n = displayName.trim();
        if (n) previewBody.name = n;
        previewBody.conversation_config = fragment;
        payloadPreviewItems.push({
          taskId,
          displayName,
          bodyText:
            '// Provisioning non ripetuto: sessione già allineata (stessa provision key, agentId in sessione).\n' +
            '// JSON di riferimento (corpo client; al create il server merge con i default ElevenLabs):\n' +
            JSON.stringify(previewBody, null, 2),
        });
        setIaProvisioningError(taskId, null);
        skipped.push(taskId);
        continue;
      }

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
          requestBody.conversation_config = fragment;
          previewEntry = {
            taskId,
            displayName,
            bodyText: JSON.stringify(requestBody, null, 2),
          };
          payloadPreviewItems.push(previewEntry);
        }
        const result = await createConvaiAgentViaOmniaServer({
          name: displayName,
          conversation_config: fragment,
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
