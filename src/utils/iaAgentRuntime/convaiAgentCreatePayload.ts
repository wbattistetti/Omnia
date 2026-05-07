/**
 * Maps Omnia {@link IAAgentConfig} to un frammento `conversation_config` per POST /elevenlabs/createAgent.
 * Il testo in `agent.prompt.prompt` viene dal compile ElevenLabs delle sezioni strutturate complete
 * ({@link resolveElevenLabsAgentPromptFromTask}) se è passato `task`, altrimenti da `cfg.systemPrompt`.
 *
 * Per le chiamate HTTP usare {@link conversationConfigForConvaiApi} sul risultato: sostituisce URL localhost
 * con le basi tunnel (localStorage) come il compile orchestrator, senza toccare {@link buildConvaiProvisionKey}.
 * La mappa porte non è in database: se la vedi ancora in `localhost`, la mappa era vuota in quel momento o stai
 * guardando un JSON pre-outbound (es. solo {@link conversationConfigFragmentFromIaAgentConfig}).
 */

import type { IAAgentConfig } from 'types/iaAgentRuntimeSetup';
import type { Task } from '@types/taskTypes';
import { rewriteCompilePayloadWithDevTunnel } from '@domain/devTunnel/devTunnelCompileBridge';
import { normalizeLanguage } from '@components/TaskEditor/EditorHost/editors/aiAgentEditor/composeRuntimeRulesFromCompact';
import { resolveElevenLabsAgentPromptFromTask } from '@components/TaskEditor/EditorHost/editors/aiAgentEditor/resolveAiAgentPlatformRulesString';
import { taskRepository } from '@services/TaskRepository';
import { buildElevenLabsConvaiPromptTools } from './elevenLabsConvaiToolsPayload';

/** Istruzioni aggiuntive ConvAI quando è presente un tool webhook BookFromAgenda (API v4.6). */
const BOOK_FROM_AGENDA_ELEVENLABS_PROMPT_APPEND = `BOOKFROMAGENDA (webhook POST …/bookfromagenda, contratto API v4.6):
- **projectId** nel JSON deve coincidere con il valore cablato in Omnia a design-time (costante identificativa); è obbligatorio nello schema tool.
- **conversationId**: runtime — usa **omnia_conversation_id** (variabile dinamica all’avvio sessione host); non ometterlo mai.
- **Prima chiamata dello scope**: includi sempre una sorgente agenda valida (**agenda.url** + **agenda.type='Omnia'**, oppure **agenda.json**).
- **forceRefresh**: runtime — true con agenda.url/agenda.json; false solo query su snapshot; il backend può dedurre se omesso.
- **queryConstraints** (opzionale): deve essere un **oggetto JSON**, mai una stringa. Esempio: \`{ "weekdays": [2, 4], "horizon": { "start": "2026-05-01", "end": "2026-05-31" } }\` (weekdays 0=domenica … 6=sabato).
Header HTTP (es. x-omnia-conversation-id) possono integrare gli scope; il modello deve comunque inviare i campi nel body come sopra.`;

function fragmentUsesBookFromAgendaWebhook(tools: Record<string, unknown>[]): boolean {
  for (const t of tools) {
    if (String(t.type) !== 'webhook') continue;
    const api = t.api_schema as Record<string, unknown> | undefined;
    const url = typeof api?.url === 'string' ? api.url.toLowerCase() : '';
    if (url.includes('bookfromagenda')) return true;
  }
  return false;
}

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

  /** ElevenLabs accetta `webhook` | `client` | … — non `function` (OpenAI). */
  const elevenTools = buildElevenLabsConvaiPromptTools(cfg, (id) => taskRepository.getTask(id), {
    manualCatalogBackendTaskIds,
  });

  let promptText = resolveConvaiAgentPromptText(cfg, options?.task, manualCatalogBackendTaskIds);
  if (elevenTools.length > 0 && fragmentUsesBookFromAgendaWebhook(elevenTools)) {
    promptText = `${promptText.trim()}\n\n${BOOK_FROM_AGENDA_ELEVENLABS_PROMPT_APPEND}`;
  }

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
 * Fragment pronto per POST ConvAI: applica {@link rewriteCompilePayloadWithDevTunnel} sulla copia (no-op se la mappa
 * tunnel in localStorage è vuota). Non dipende dalla checkbox «Compilazione con tunnel» quella controlla solo errori
 * di compilazione orchestrator. Non applicare a {@link buildConvaiProvisionKey}: gli URL ngrok cambiano tra sessioni.
 */
export function conversationConfigForConvaiApi(
  fragment: Record<string, unknown> | null
): Record<string, unknown> | null {
  if (!fragment) return null;
  return rewriteCompilePayloadWithDevTunnel(
    JSON.parse(JSON.stringify(fragment)) as Record<string, unknown>
  ) as Record<string, unknown>;
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
