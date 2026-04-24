/**
 * Pre-run provisioning: for every AI Agent task on the canvas that is ElevenLabs
 * but lacks a `convaiAgentId`, calls createAgent and writes the id back to
 * TaskRepository via `persistIaRuntimeOverrideSnapshot` before compilation starts.
 */

import type { Node } from 'reactflow';
import type { FlowNode } from '../Flowchart/types/flowTypes';
import { enrichRowsWithTaskId } from '../../utils/taskHelpers';
import { taskRepository } from '../../services/TaskRepository';
import { TaskType } from '../../types/taskTypes';
import type { Task } from '../../types/taskTypes';
import { createConvaiAgentViaOmniaServer } from '../../services/convaiProvisionApi';
import { conversationConfigFragmentFromIaAgentConfig } from '../../utils/iaAgentRuntime/convaiAgentCreatePayload';
import { iaAgentConfigWithEditorSystemPrompt } from '../../utils/iaAgentRuntime/iaAgentConfigWithEditorSystemPrompt';
import { normalizeIAAgentConfig } from '../../utils/iaAgentRuntime/iaAgentConfigNormalize';
import { resolveTaskIaConfig } from '../../utils/iaAgentRuntime/resolveTaskIaConfig';
import type { NormalizedIaProviderError } from '@domain/compileErrors/iaProviderErrors';
import { normalizeProviderError } from '@domain/compileErrors/normalizeProviderError';
import { setIaProvisioningError } from '@domain/compileErrors/iaProvisioningErrorStore';

/** True when the task is ElevenLabs + no convaiAgentId on the task or in global defaults. */
function needsProvisioning(task: Task): boolean {
  const cfg = resolveTaskIaConfig(task);
  if (cfg.platform !== 'elevenlabs') return false;
  const id = cfg.convaiAgentId?.trim();
  return !id;
}

/** True when UI/runtime ha marcato un nuovo `ttsModel` e serve un nuovo `createAgent` (stesso flusso merge conversation_config). */
function needsTtsReprovisioning(task: Task): boolean {
  const cfg = resolveTaskIaConfig(task);
  if (cfg.platform !== 'elevenlabs') return false;
  if (!cfg.convaiAgentId?.trim()) return false;
  return cfg.elevenLabsNeedsReprovision === true;
}

function notifyTasksLoadedForCurrentProject(): void {
  if (typeof window === 'undefined') return;
  try {
    const projectId = localStorage.getItem('currentProjectId') ?? undefined;
    if (!projectId) return;
    window.dispatchEvent(new CustomEvent('tasks:loaded', { detail: { projectId, tasksCount: 0 } }));
  } catch {
    /* noop */
  }
}

/** Writes convaiAgentId to TaskRepository (normalizes current override, patches only agentIaRuntimeOverrideJson). */
function persistAgentId(task: Task, agentId: string): void {
  const cfg = iaAgentConfigWithEditorSystemPrompt(resolveTaskIaConfig(task), task);
  const updated = normalizeIAAgentConfig({ ...cfg, convaiAgentId: agentId });
  const iaJson = JSON.stringify(updated);
  const ok = taskRepository.updateTask(task.id, { agentIaRuntimeOverrideJson: iaJson } as Partial<Task>);
  if (!ok) {
    console.error('[IA·ConvAI] auto-provision: updateTask failed', { taskId: task.id });
  }
}

/** Dopo re-provision TTS: nuovo agent id, flag client resettato, editor si riallinea con `tasks:loaded`. */
function finalizeTtsReprovision(task: Task, newAgentId: string, previousAgentId: string): void {
  const cfg = iaAgentConfigWithEditorSystemPrompt(resolveTaskIaConfig(task), task);
  const ttsLabel = String(cfg.ttsModel ?? '').trim() || '(default lingua)';
  const updated = normalizeIAAgentConfig({
    ...cfg,
    convaiAgentId: newAgentId,
    elevenLabsNeedsReprovision: false,
  });
  const iaJson = JSON.stringify(updated);
  const ok = taskRepository.updateTask(task.id, { agentIaRuntimeOverrideJson: iaJson } as Partial<Task>);
  if (!ok) {
    console.error('[IA·ConvAI] reprovision: updateTask failed', { taskId: task.id });
    return;
  }
  const short = (s: string) => (s.length <= 12 ? s : `${s.slice(0, 12)}…`);
  console.info(
    `[IA·ConvAI] Re-provision ElevenLabs ConvAI agent because TTS model changed (effective ttsModel=${ttsLabel}). ` +
      `agentId ${short(previousAgentId)} → ${short(newAgentId)}`
  );
  notifyTasksLoadedForCurrentProject();
}

/**
 * Scans all AI Agent task rows on `nodes`, provisions a ConvAI agent for each that
 * needs one (ElevenLabs + no id). Sequential — avoids concurrent create calls for the
 * same task if it appears in multiple nodes.
 *
 * Non-blocking: errors are caught per-task so one failure does not block others.
 * Returns a summary for log/debugging.
 */
export async function ensureConvaiAgentsProvisioned(nodes: Node<FlowNode>[]): Promise<{
  provisioned: string[];
  reprovisioned: string[];
  skipped: string[];
  failed: string[];
}> {
  const enriched = nodes.map((node) => ({
    ...node,
    data: { ...node.data, rows: enrichRowsWithTaskId(node.data?.rows || []) },
  }));

  const seen = new Set<string>();
  const provisioned: string[] = [];
  const reprovisioned: string[] = [];
  const skipped: string[] = [];
  const failed: string[] = [];

  for (const node of enriched) {
    const rows = node.data?.rows || [];
    for (const row of rows) {
      const taskId = String(row.id || row.taskId || '').trim();
      if (!taskId || seen.has(taskId)) continue;
      seen.add(taskId);

      const task = taskRepository.getTask(taskId);
      if (!task || task.type !== TaskType.AIAgent) continue;

      if (needsProvisioning(task)) {
        console.info('[IA·ConvAI] auto-provision: provisioning ConvAI agent for task', { taskId });
        try {
          const cfgForCreate = iaAgentConfigWithEditorSystemPrompt(resolveTaskIaConfig(task), task);
          const fragment = conversationConfigFragmentFromIaAgentConfig(cfgForCreate, { omitTts: true });
          const { agentId } = await createConvaiAgentViaOmniaServer({
            name: `Omnia · ${taskId}`,
            ...(fragment ? { conversation_config: fragment } : {}),
          });
          persistAgentId(task, agentId);
          provisioned.push(taskId);
          setIaProvisioningError(taskId, null);
          console.info('[IA·ConvAI] auto-provision: agent created', {
            taskId,
            agentIdChars: agentId.length,
          });
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
          console.error('[IA·ConvAI] auto-provision: createAgent failed', {
            taskId,
            error: err instanceof Error ? err.message : String(err),
            normalized,
          });
        }
        continue;
      }

      if (needsTtsReprovisioning(task)) {
        const cfg = resolveTaskIaConfig(task);
        const prevAgentId = cfg.convaiAgentId!.trim();
        console.info('[IA·ConvAI] reprovision: createAgent for TTS / conversation_config refresh', {
          taskId,
          ttsModel: String(cfg.ttsModel ?? '').trim() || '(default lingua)',
        });
        try {
          const cfgForCreate = iaAgentConfigWithEditorSystemPrompt(cfg, task);
          const fragment = conversationConfigFragmentFromIaAgentConfig(cfgForCreate);
          const { agentId } = await createConvaiAgentViaOmniaServer({
            name: `Omnia · ${taskId}`,
            ...(fragment ? { conversation_config: fragment } : {}),
          });
          finalizeTtsReprovision(task, agentId, prevAgentId);
          reprovisioned.push(taskId);
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
          console.error('[IA·ConvAI] reprovision: createAgent failed', {
            taskId,
            error: err instanceof Error ? err.message : String(err),
            normalized,
          });
        }
        continue;
      }

      setIaProvisioningError(taskId, null);
      skipped.push(taskId);
    }
  }

  return { provisioned, reprovisioned, skipped, failed };
}
