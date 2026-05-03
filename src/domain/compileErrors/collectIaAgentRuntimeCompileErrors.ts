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
import {
  mergeResolvedAndLiveIaConfig,
  peekConvaiLiveIaConfig,
} from '@utils/iaAgentRuntime/convaiLiveIaConfigBridge';
import {
  deriveBackendToolDefinition,
  mergeEffectiveIaAgentTools,
} from '@domain/iaAgentTools/backendToolDerivation';
import type { DeriveBackendToolFailureCode } from '@domain/iaAgentTools/backendToolDerivation';
import { collectReachableBackendCallTaskIdsFromFlow } from '@domain/iaAgentTools/collectReachableBackendCallTaskIdsFromFlow';
import { mergeConvaiBackendToolIdLists } from '@domain/iaAgentTools/manualCatalogBackendToolIds';

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
  const base = mergeConvaiAgentIdFromGlobalDefaults(merged, globals);
  return mergeResolvedAndLiveIaConfig(base, peekConvaiLiveIaConfig(task.id));
}

function compileErrorCodeForDerivationFailure(code: DeriveBackendToolFailureCode): string {
  switch (code) {
    case 'missing_label':
      return 'IaConvaiBackendToolMissingLabel';
    case 'missing_backend_tool_description':
      return 'IaConvaiBackendToolMissingDescription';
    case 'not_backend_call':
    case 'missing_task':
    default:
      return 'IaConvaiBackendToolInvalid';
  }
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

const PROVISIONING_RAW_EXCERPT_MAX = 600;

function provisioningRawExcerpt(raw: unknown): string | undefined {
  if (raw === undefined) return undefined;
  try {
    let text: string;
    if (typeof raw === 'string') text = raw;
    else if (raw instanceof Error) text = raw.stack ?? raw.message;
    else text = JSON.stringify(raw);
    const trimmed = text.trim();
    if (!trimmed) return undefined;
    return trimmed.length > PROVISIONING_RAW_EXCERPT_MAX
      ? `${trimmed.slice(0, PROVISIONING_RAW_EXCERPT_MAX)}…`
      : trimmed;
  } catch {
    const t = String(raw).trim();
    if (!t) return undefined;
    return t.length > PROVISIONING_RAW_EXCERPT_MAX ? `${t.slice(0, PROVISIONING_RAW_EXCERPT_MAX)}…` : t;
  }
}

/** Provider:code tag plus optional JSON / error excerpt from {@link NormalizedIaProviderError.raw}. */
function buildProvisioningTechnicalDetail(snapshot: NormalizedIaProviderError): string | undefined {
  const tag =
    snapshot.provider !== 'unknown' ? `${snapshot.provider}:${snapshot.code}` : undefined;
  const rawPart = provisioningRawExcerpt(snapshot.raw);
  if (tag && rawPart) return `${tag}\n${rawPart}`;
  if (tag) return tag;
  if (rawPart) return rawPart;
  return undefined;
}

/** Opzioni: grafi persistiti per rilevare Backend Call raggiungibili senza id in `convaiBackendToolTaskIds`. */
export type CollectIaAgentRuntimeCompileErrorsOptions = {
  flowsByFlowId?: Record<string, { nodes?: unknown[]; edges?: unknown[] } | undefined>;
  /** Tab Backends / catalogo manuale progetto — include gli id nei tool ConvAI effettivi. */
  manualCatalogBackendTaskIds?: readonly string[];
};

/**
 * Raw compiler-shaped payloads for `enrichCompilationError`.
 */
export function collectIaAgentRuntimeCompileErrors(
  mergedTasks: unknown[],
  locations: Map<string, AiAgentTaskLocation>,
  rootFlowId: string,
  options?: CollectIaAgentRuntimeCompileErrorsOptions
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
        technicalDetail: buildProvisioningTechnicalDetail(provisioningSnapshot),
      });
    }

    switch (cfg.platform) {
      case 'elevenlabs': {
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

        const backendIds = cfg.convaiBackendToolTaskIds ?? [];
        const normalizedBackendIds = backendIds.map((x) => String(x || '').trim()).filter(Boolean);
        const manualCatalogIds = (options?.manualCatalogBackendTaskIds ?? []).map((x) =>
          String(x || '').trim()
        ).filter(Boolean);
        const effectiveBackendIds = mergeConvaiBackendToolIdLists(normalizedBackendIds, manualCatalogIds);
        const mergedTools = mergeEffectiveIaAgentTools(cfg, (id) => taskRepository.getTask(id), {
          manualCatalogBackendTaskIds: manualCatalogIds,
        });

        const flowIdForReachability = String(loc?.flowId ?? rootFlowId).trim() || rootFlowId;
        const flowDoc = options?.flowsByFlowId?.[flowIdForReachability];
        const flowSlice =
          flowDoc && Array.isArray(flowDoc.nodes) && flowDoc.nodes.length > 0
            ? {
                nodes: flowDoc.nodes,
                edges: Array.isArray(flowDoc.edges) ? flowDoc.edges : [],
              }
            : null;
        const reachableBackendIds = collectReachableBackendCallTaskIdsFromFlow(
          flowSlice,
          task.id,
          (id) => taskRepository.getTask(id)
        );
        if (reachableBackendIds.length > 0 && effectiveBackendIds.length === 0) {
          push(
            'IaConvaiBackendToolIdsEmpty',
            'Nessun tool ConvAI selezionato: sul canvas ci sono Backend Call raggiungibili dall’agente, ma `convaiBackendToolTaskIds` è vuoto. In Agent setup → backend aggiungi gli id o usa «Aggiungi da canvas».',
            'tools'
          );
        }

        for (const bid of effectiveBackendIds) {
          const tid = String(bid || '').trim();
          if (!tid) continue;
          const bt = taskRepository.getTask(tid);
          if (!bt) {
            push(
              'IaConvaiBackendToolMissing',
              `ConvAI: Backend Call task ${tid.slice(0, 8)}… non trovato nel progetto.`,
              'tools'
            );
            continue;
          }
          if (bt.type !== TaskType.BackendCall) {
            push(
              'IaConvaiBackendToolWrongType',
              `ConvAI: il task ${tid.slice(0, 8)}… non è di tipo Backend Call.`,
              'tools'
            );
            continue;
          }
          const ep = (bt as Task & { endpoint?: { url?: string } }).endpoint;
          const url = ep && typeof ep.url === 'string' ? ep.url.trim() : '';
          if (!url) {
            push(
              'IaConvaiBackendToolNoUrl',
              `ConvAI: Backend Call (${tid.slice(0, 8)}…) senza URL endpoint.`,
              'tools'
            );
          }
          const dr = deriveBackendToolDefinition(bt);
          if (!dr.ok) {
            push(
              compileErrorCodeForDerivationFailure(dr.code),
              `ConvAI: ${dr.error}`,
              'tools'
            );
          }
        }

        for (const td of mergedTools) {
          if (!td.name.trim()) {
            push('IaConvaiToolMissingName', 'ConvAI: ogni tool deve avere un nome non vuoto.', 'tools');
          }
          if (!td.description.trim()) {
            push(
              'IaConvaiToolMissingDescription',
              `ConvAI: il tool «${td.name || '(senza nome)'}» richiede una descrizione non vuota.`,
              'tools'
            );
          }
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
