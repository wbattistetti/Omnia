/**
 * Client-side validation of per-task IA runtime (agentIaRuntimeOverrideJson + global defaults)
 * for AI Agent tasks. Emits structured errors merged into the compile JSON like other guards.
 */

import type { Node } from 'reactflow';
import type { FlowNode, NodeRow } from '@components/Flowchart/types/flowTypes';
import { taskRepository } from '@services/TaskRepository';
import { TaskType, type Task } from '@types/taskTypes';
import type { IAAgentConfig } from 'types/iaAgentRuntimeSetup';
import type { IaRuntimeFocus } from '@components/FlowCompiler/types';
import type { NormalizedIaProviderError } from './iaProviderErrors';
import { inferFixAction, providerFixActionToIaRuntimeFocus } from './fixActions';
import { getIaProvisioningError } from './iaProvisioningErrorStore';
import {
  mergeConvaiAgentIdFromGlobalDefaults,
  normalizeIAAgentConfig,
  parseOptionalIaRuntimeJson,
} from '@utils/iaAgentRuntime/iaAgentConfigNormalize';
import { loadGlobalIaAgentConfig } from '@utils/iaAgentRuntime/globalIaAgentPersistence';
import { getConvaiSessionBinding } from '@utils/iaAgentRuntime/convaiSessionAgentStore';

export type AiAgentTaskLocation = {
  nodeId?: string;
  rowId?: string;
  flowId?: string;
};

/** Maps AI Agent canvas instance task id → flowchart placement (for Fix + error grouping). */
export function mergeAiAgentTaskLocations(
  map: Map<string, AiAgentTaskLocation>,
  enrichedNodes: Node<FlowNode>[],
  flowId: string
): void {
  for (const node of enrichedNodes) {
    const rows = node.data?.rows ?? [];
    for (const row of rows as NodeRow[]) {
      const tid = String(row.id || (row as { taskId?: string }).taskId || '').trim();
      if (!tid) continue;
      const task = taskRepository.getTask(tid);
      if (task?.type === TaskType.AIAgent) {
        map.set(tid, { nodeId: node.id, rowId: tid, flowId });
      }
    }
  }
}

function effectiveIaConfig(task: Task): IAAgentConfig {
  const globals = loadGlobalIaAgentConfig();
  const parsed = parseOptionalIaRuntimeJson(task.agentIaRuntimeOverrideJson);
  const merged = normalizeIAAgentConfig(parsed ?? globals);
  return mergeConvaiAgentIdFromGlobalDefaults(merged, globals);
}

function primaryVoiceId(cfg: IAAgentConfig): string {
  const fromList = cfg.voices?.find((e) => e.role === 'primary')?.id?.trim();
  if (fromList) return fromList;
  return (cfg.voice?.id ?? '').trim();
}

function llmModelForElevenLabs(cfg: IAAgentConfig): string {
  const adv = cfg.advanced ?? {};
  const llm = adv.llm && typeof adv.llm === 'object' && !Array.isArray(adv.llm) ? (adv.llm as Record<string, unknown>) : {};
  return typeof llm.model === 'string' ? llm.model.trim() : '';
}

/**
 * Raw compiler-shaped payloads for `enrichCompilationError`.
 */
export function collectIaAgentRuntimeCompileErrors(
  mergedTasks: unknown[],
  locations: Map<string, AiAgentTaskLocation>,
  rootFlowId: string
): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];

  for (const raw of mergedTasks) {
    const task = raw as Task;
    if (!task?.id || task.type !== TaskType.AIAgent) continue;

    const loc = locations.get(task.id);
    const cfg = effectiveIaConfig(task);

    const prefix =
      loc?.flowId && loc.flowId !== rootFlowId ? `[${loc.flowId}] ` : '';

    const push = (code: string, message: string, focus: IaRuntimeFocus) => {
      out.push({
        taskId: task.id,
        nodeId: loc?.nodeId,
        rowId: loc?.rowId ?? task.id,
        message: `${prefix}${message}`,
        severity: 'Error',
        category: 'IaProviderConfiguration',
        code,
        fixTarget: { type: 'iaRuntime', taskId: task.id, focus },
        taskType: TaskType.AIAgent,
      });
    };

    const provisioningSnapshot: NormalizedIaProviderError | undefined =
      getIaProvisioningError(task.id) ??
      (task as Task & { provisioningError?: NormalizedIaProviderError }).provisioningError;

    if (provisioningSnapshot) {
      const fixAction = inferFixAction(provisioningSnapshot);
      const focus = providerFixActionToIaRuntimeFocus(fixAction);
      out.push({
        taskId: task.id,
        nodeId: loc?.nodeId,
        rowId: loc?.rowId ?? task.id,
        message: `${prefix}${provisioningSnapshot.message}`,
        severity: 'Error',
        category: 'IaProviderProvisioning',
        code: 'IaProvisionProviderError',
        fixTarget: { type: 'iaRuntime', taskId: task.id, focus },
        taskType: TaskType.AIAgent,
        technicalDetail:
          provisioningSnapshot.provider !== 'unknown'
            ? `${provisioningSnapshot.provider}:${provisioningSnapshot.code}`
            : undefined,
      });
    }

    switch (cfg.platform) {
      case 'elevenlabs': {
        const sessionAgentId = getConvaiSessionBinding(task.id)?.agentId?.trim() ?? '';
        if (!sessionAgentId && !cfg.convaiAgentId?.trim() && !provisioningSnapshot) {
          push(
            'IaElevenLabsMissingAgentId',
            'ElevenLabs: manca ConvAI Agent ID — crea l’agente o incolla l’ID da ElevenLabs.',
            'agentId'
          );
        }
        if (!primaryVoiceId(cfg)) {
          push('IaElevenLabsMissingVoice', 'ElevenLabs: seleziona una voce nel catalogo.', 'voice');
        }
        const lang = (cfg.voice?.language ?? '').trim();
        if (!lang) {
          push('IaElevenLabsMissingLanguage', 'ElevenLabs: seleziona la lingua dell’agente.', 'language');
        }
        if (!llmModelForElevenLabs(cfg)) {
          push(
            'IaElevenLabsMissingLlmModel',
            'ElevenLabs: seleziona il modello LLM per ConvAI.',
            'llm'
          );
        }
        break;
      }
      case 'openai': {
        if (!cfg.model?.trim()) {
          push('IaOpenAiMissingModel', 'OpenAI: indica il modello.', 'model');
        }
        if (!cfg.maxTokens || cfg.maxTokens < 1) {
          push('IaOpenAiMissingMaxTokens', 'OpenAI: imposta max token (> 0).', 'maxTokens');
        }
        break;
      }
      case 'anthropic': {
        if (!cfg.model?.trim()) {
          push('IaAnthropicMissingModel', 'Anthropic: indica il modello.', 'model');
        }
        break;
      }
      case 'google': {
        if (!cfg.model?.trim()) {
          push('IaGeminiMissingModel', 'Gemini: indica il modello.', 'model');
        }
        break;
      }
      case 'custom': {
        if (!cfg.model?.trim()) {
          push('IaCustomMissingModel', 'Provider personalizzato: indica il modello.', 'model');
        }
        break;
      }
      default:
        break;
    }
  }

  return out;
}
