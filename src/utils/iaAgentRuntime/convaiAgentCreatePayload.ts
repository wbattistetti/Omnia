/**
 * Maps Omnia {@link IAAgentConfig} to un frammento `conversation_config` per POST /elevenlabs/createAgent.
 * Il testo in `agent.prompt.prompt` viene dal compile ElevenLabs delle sezioni strutturate complete
 * ({@link resolveElevenLabsAgentPromptFromTask}) se è passato `task`, altrimenti da `cfg.systemPrompt`.
 */

import type { IAAgentConfig } from 'types/iaAgentRuntimeSetup';
import type { Task } from '@types/taskTypes';
import { normalizeLanguage } from '@components/TaskEditor/EditorHost/editors/aiAgentEditor/composeRuntimeRulesFromCompact';
import { resolveElevenLabsAgentPromptFromTask } from '@components/TaskEditor/EditorHost/editors/aiAgentEditor/resolveAiAgentPlatformRulesString';
import { taskRepository } from '@services/TaskRepository';
import { buildElevenLabsConvaiPromptTools } from './elevenLabsConvaiToolsPayload';

/** ConvAI default greeting when designer «Avvio immediato» is off. */
export const CONVAI_DEFAULT_FIRST_MESSAGE = 'Hello! How can I help you today?';

export type ConversationConfigFragmentOptions = {
  /**
   * Skip `tts.voice_id` (used for Run auto-provision): catalog voice IDs may not exist on the
   * ElevenLabs EU residency cluster → 422. Voice can be set in ElevenLabs UI after creation.
   */
  omitTts?: boolean;
  /**
   * Task AI Agent: testo = compile ElevenLabs a partire dalle sezioni (stesso criterio semanticamente della VB compile).
   * Se omesso, si usa solo `cfg.systemPrompt` (es. default globali da Studio) — deve essere non vuoto.
   */
  task?: Task | null;
  /** Backend catalogo progetto (`manualEntries`): stessi tool della tab Backends dell’editor. */
  manualCatalogBackendTaskIds?: readonly string[];
};

function primaryVoiceId(cfg: IAAgentConfig): string {
  const fromList = cfg.voices?.find((e) => e.role === 'primary')?.id?.trim();
  if (fromList) return fromList;
  return (cfg.voice?.id ?? '').trim();
}

/**
 * Risolve `tts.model_id` per ConvAI: scelta esplicita in UI, altrimenti default per lingua agente.
 * Per `language !== en` senza override, ElevenLabs richiede Flash/Turbo v2.5 (errore noto in runtime).
 */
export function resolveConvaiTtsModelId(cfg: IAAgentConfig, lang: string): string {
  const raw = typeof cfg.ttsModel === 'string' ? cfg.ttsModel.trim() : '';
  if (raw.length > 0) return raw;
  return lang === 'en' ? 'eleven_flash_v2' : 'eleven_flash_v2_5';
}

/**
 * ElevenLabs EU residency often rejects LLM ids that are valid on the global API.
 * Map known mismatches before POST /v1/convai/agents/create (see API 422 + `detail`).
 */
function mapLlmModelForElevenLabsResidencyCreate(raw: string): string {
  const t = raw.trim();
  if (t === 'gpt-4o-mini') return 'gpt-4o';
  return t;
}

/**
 * Testo istruzioni per `conversation_config.agent.prompt.prompt`: da task editor (preferito) o da
 * `cfg.systemPrompt` se non c’è task. Nessun prompt generato da Omnia se manca l’input.
 */
function resolveConvaiAgentPromptText(
  cfg: IAAgentConfig,
  task: Task | null | undefined,
  manualCatalogBackendTaskIds: readonly string[] | undefined
): string {
  if (task != null) {
    const fromEditor = resolveElevenLabsAgentPromptFromTask(task, {
      manualCatalogBackendTaskIds,
    }).trim();
    if (fromEditor.length > 0) {
      return fromEditor;
    }
    /** Task senza testo in editor: ultimo tentativo = override runtime già persistito (no stringa Omnia generata). */
    if (typeof cfg.systemPrompt === 'string' && cfg.systemPrompt.length > 0) {
      return cfg.systemPrompt;
    }
    throw new Error(
      'ConvAI createAgent: prompt del task vuoto. Compila agentPrompt o runtime compact prima di creare l’agente.'
    );
  }
  if (typeof cfg.systemPrompt === 'string' && cfg.systemPrompt.length > 0) {
    return cfg.systemPrompt;
  }
  throw new Error(
    'ConvAI createAgent: prompt vuoto. Imposta le istruzioni nel runtime IA (o nel task) prima di creare l’agente.'
  );
}

/**
 * Returns a partial `conversation_config` for ConvAI `agents/create`, or `null` if the platform
 * is not ElevenLabs (caller should skip the key in the request body).
 */
export function conversationConfigFragmentFromIaAgentConfig(
  cfg: IAAgentConfig,
  options?: ConversationConfigFragmentOptions
): Record<string, unknown> | null {
  if (cfg.platform !== 'elevenlabs') return null;

  const adv = cfg.advanced ?? {};
  const llm =
    adv.llm && typeof adv.llm === 'object' && !Array.isArray(adv.llm)
      ? (adv.llm as Record<string, unknown>)
      : {};

  const voiceId = primaryVoiceId(cfg);
  const langRaw =
    typeof cfg.voice?.language === 'string' && cfg.voice.language.trim().length > 0
      ? cfg.voice.language.trim()
      : 'en';
  const lang = normalizeLanguage(langRaw) ?? 'en';

  const llmModel = mapLlmModelForElevenLabsResidencyCreate(
    typeof llm.model === 'string' && llm.model.trim().length > 0 ? llm.model.trim() : 'gpt-4o'
  );
  const manualCatalogBackendTaskIds = options?.manualCatalogBackendTaskIds ?? [];
  const promptText = resolveConvaiAgentPromptText(cfg, options?.task, manualCatalogBackendTaskIds);

  const prompt: Record<string, unknown> = {
    prompt: promptText,
    llm: llmModel,
  };
  if (typeof llm.temperature === 'number' && !Number.isNaN(llm.temperature)) {
    prompt.temperature = llm.temperature;
  }
  if (typeof llm.max_tokens === 'number' && llm.max_tokens > 0) {
    prompt.max_tokens = Math.floor(llm.max_tokens);
  }

  /** ElevenLabs accetta `webhook` | `client` | … — non `function` (OpenAI). */
  const elevenTools = buildElevenLabsConvaiPromptTools(cfg, (id) => taskRepository.getTask(id), {
    manualCatalogBackendTaskIds,
  });
  if (elevenTools.length > 0) {
    (prompt as Record<string, unknown>).tools = elevenTools;
  }

  const immediateStart = options?.task?.agentImmediateStart === true;
  const agent: Record<string, unknown> = {
    /** Empty when «Avvio immediato»: orchestrator injects a synthetic user turn instead. */
    first_message: immediateStart ? '' : CONVAI_DEFAULT_FIRST_MESSAGE,
    language: lang,
    prompt,
  };

  const out: Record<string, unknown> = {
    agent,
  };

  const omitTts = options?.omitTts === true;
  if (!omitTts && voiceId) {
    out.tts = {
      voice_id: voiceId,
      model_id: resolveConvaiTtsModelId(cfg, lang),
    };
  }

  return out;
}

/**
 * Chiave per confronto in sessione (stesso payload ConvAI che verrebbe inviato a createAgent).
 */
export function buildConvaiProvisionKey(
  cfg: IAAgentConfig,
  task: Task | null | undefined,
  omitTts: boolean,
  options?: Pick<ConversationConfigFragmentOptions, 'manualCatalogBackendTaskIds'>
): string {
  const fragment = conversationConfigFragmentFromIaAgentConfig(cfg, {
    omitTts,
    task: task ?? undefined,
    manualCatalogBackendTaskIds: options?.manualCatalogBackendTaskIds,
  });
  if (!fragment) return '';
  try {
    return JSON.stringify(fragment);
  } catch {
    return '';
  }
}
