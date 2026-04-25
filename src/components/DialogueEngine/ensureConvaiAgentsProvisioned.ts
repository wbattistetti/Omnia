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

/** Contesto per il nome leggibile ElevenLabs (slug + GUID). */
export type ConvaiProvisionContext = {
  projectLabel: string;
  rootFlowLabel: string;
  /** taskId → etichetta nodo canvas */
  nodeLabelByTaskId: Record<string, string>;
};

const OMIT_TTS_ON_CREATE = true;

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

      const session = getConvaiSessionBinding(taskId);
      if (session && session.lastProvisionKey === provisionKey && session.agentId.trim().length > 0) {
        setIaProvisioningError(taskId, null);
        skipped.push(taskId);
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

      try {
        const matches = await listAllConvaiAgentsMatchingTaskGuid(taskId);
        for (const m of matches) {
          console.warn('[DEBUG] DELETE AGENT', m.agentId, { name: m.name });
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

        let fragment: Record<string, unknown>;
        try {
          fragment = conversationConfigFragmentFromIaAgentConfig(cfgForCreate, {
            omitTts: OMIT_TTS_ON_CREATE,
            task,
          })!;
        } catch (buildErr) {
          throw buildErr;
        }

        const payload = { conversation_config: fragment };
        console.warn('[DEBUG] CREATE AGENT PAYLOAD', JSON.stringify({ name: displayName, ...payload }, null, 2));
        const { agentId } = await createConvaiAgentViaOmniaServer({
          name: displayName,
          conversation_config: fragment,
        });
        console.warn('[DEBUG] NEW AGENT ID', agentId);

        setConvaiSessionBinding(taskId, agentId, provisionKey);
        provisioned.push(taskId);
        setIaProvisioningError(taskId, null);
      } catch (err) {
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

  return { provisioned, skipped, failed };
}
