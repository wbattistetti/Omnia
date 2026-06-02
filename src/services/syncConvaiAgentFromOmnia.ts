/**
 * Sync completa agente ConvAI ElevenLabs: system prompt (use case + backend + KB testo),
 * tool webhook catalogo, documenti KB nativi ElevenLabs.
 */

import { TaskType, type Task } from '@types/taskTypes';
import {
  mergeExternalAgentPromptSections,
  buildExternalAgentPromptSections,
} from '@domain/agentDesign/buildMergedExternalAgentPrompt';
import { KNOWLEDGE_BASE_PROMPT_HEADER } from '@domain/agentDesign/buildKbRuntimePromptSection';
import { DEFAULT_CONVERSATIONAL_CATALOG_FORMAT } from '@domain/useCaseGeneratorWizard/catalogFormat';
import {
  parseAgentStartPromptJson,
  resolveAgentStartPromptSpeechText,
} from '@domain/useCaseGeneratorWizard/agentStartPrompt';
import { resolveStartUseCaseSpeechText } from '@domain/useCaseGeneratorWizard/startUseCase';
import { openApiCompileErrorsFromTask } from '@domain/openApi/openApiCompileErrorsFromTask';
import { buildConvaiWebhookToolFromBackendTask } from '@utils/iaAgentRuntime/elevenLabsConvaiToolsPayload';
import {
  collectConvaiWebhookTunnelReadinessForSync,
  prepareConvaiWebhookToolForElevenLabsApi,
  resolveConvaiSyncBackendTaskIds,
} from '@utils/iaAgentRuntime/prepareConvaiWebhookToolForElevenLabsApi';
import {
  conversationConfigForConvaiApi,
  CONVAI_DEFAULT_FIRST_MESSAGE,
  buildConvaiTtsBlockForApi,
  mapConvaiLlmForAgentLanguage,
} from '@utils/iaAgentRuntime/convaiAgentCreatePayload';
import { resolveConvaiAgentLanguageForSync } from '@components/TaskEditor/EditorHost/editors/aiAgentEditor/resolveAiAgentOutputLanguage';
import { resolveTaskIaConfig } from '@utils/iaAgentRuntime/resolveTaskIaConfig';
import { createConvaiAgentViaOmniaServer } from '@services/convaiProvisionApi';
import { patchConvaiAgent } from '@workspaces/elevenlabs/api/convaiAgentApi';
import { createConvaiTool } from '@workspaces/elevenlabs/api/convaiToolApi';
import { createConvaiKbDocumentFromText } from '@workspaces/elevenlabs/api/convaiKnowledgeBaseApi';
import { taskRepository } from '@services/TaskRepository';
import {
  listKbDocumentsForConvaiUpload,
  resolveKbTextForConvaiUploadAsync,
} from '@domain/convai/resolveKbTextForConvaiUpload';
import type {
  ConvaiAgentSyncFailure,
  ConvaiAgentSyncParams,
  ConvaiAgentSyncResult,
  ConvaiAgentSyncToolResult,
} from '@domain/convai/convaiAgentSyncTypes';

const BOOK_FROM_AGENDA_PROMPT_APPEND = `BOOKFROMAGENDA (webhook POST …/bookfromagenda, contratto API v4.6):
- **projectId** nel JSON deve coincidere con il valore cablato in Omnia a design-time.
- **conversationId**: runtime — usa **omnia_conversation_id**.
- **Prima chiamata dello scope**: includi sempre una sorgente agenda valida (**agenda.url** + **agenda.type='Omnia'**, oppure **agenda.json**).
- **forceRefresh**: runtime — true con agenda.url/agenda.json; false solo query su snapshot.
- **queryConstraints** (opzionale): oggetto JSON, mai stringa.`;

function primaryVoiceId(cfg: import('types/iaAgentRuntimeSetup').IAAgentConfig): string {
  const fromList = cfg.voices?.find((e) => e.role === 'primary')?.id?.trim();
  if (fromList) return fromList;
  return (cfg.voice?.id ?? '').trim();
}

type ResolvedKbForSync = { doc: import('@domain/knowledgeBase/kbDocumentTypes').StagedKbDocument; text: string };

async function resolveKbTextsForConvaiSync(
  params: ConvaiAgentSyncParams
): Promise<ResolvedKbForSync[]> {
  const out: ResolvedKbForSync[] = [];
  for (const doc of listKbDocumentsForConvaiUpload(params.knowledgeBaseDocuments)) {
    const text = await resolveKbTextForConvaiUploadAsync(doc, params.projectId);
    if (text) out.push({ doc, text });
  }
  return out;
}

function buildSyncPromptText(
  params: ConvaiAgentSyncParams,
  kbResolved: readonly ResolvedKbForSync[]
): string {
  const startPrompt = parseAgentStartPromptJson(
    String(params.agentTask.agentStartPromptJson ?? '')
  );
  const sections = buildExternalAgentPromptSections({
    useCases: params.useCases,
    startPrompt,
    startUseCaseId: String(params.agentTask.agentStartUseCaseId ?? '').trim() || undefined,
    conversationalRules: params.conversationalRules,
    includeLog: params.includeLog,
    includeBackendLog: params.includeBackendLog,
    agentBehavior: params.agentBehavior ?? 'B',
    catalogFormat: params.catalogFormat ?? DEFAULT_CONVERSATIONAL_CATALOG_FORMAT,
    agentTaskId: String(params.agentTask.id ?? '').trim(),
    backendCatalog: params.backendCatalog,
    manualCatalogBackendTaskIds: params.manualCatalogBackendTaskIds,
    knowledgeBaseDocuments: [],
  });
  if (kbResolved.length > 0) {
    const kbBlocks = kbResolved.map(
      ({ doc, text }) => `**${doc.name}**\n${text.slice(0, 6_000)}`
    );
    sections.knowledgeBase = `${KNOWLEDGE_BASE_PROMPT_HEADER}\n\n${kbBlocks.join('\n\n')}`;
  }
  return mergeExternalAgentPromptSections(sections).trim();
}

function resolveBackendTaskIds(params: ConvaiAgentSyncParams): string[] {
  return resolveConvaiSyncBackendTaskIds(params);
}

function usesBookFromAgenda(tools: ConvaiAgentSyncToolResult[], backendIds: string[]): boolean {
  for (const tid of backendIds) {
    const t = taskRepository.getTask(tid);
    if (!t || t.type !== TaskType.BackendCall) continue;
    const ep = (t as Task & { endpoint?: { url?: string } }).endpoint;
    const url = String(ep?.url ?? '').toLowerCase();
    if (url.includes('bookfromagenda')) return true;
  }
  return tools.some((x) => x.toolName.toLowerCase().includes('book'));
}

/**
 * Crea o aggiorna un agente ConvAI con prompt, tool webhook e documenti KB da Omnia.
 */
export async function syncConvaiAgentFromOmnia(
  params: ConvaiAgentSyncParams
): Promise<
  | { ok: true; result: ConvaiAgentSyncResult }
  | { ok: false; failure: ConvaiAgentSyncFailure }
> {
  const agentTask = params.agentTask;
  if (agentTask.type !== TaskType.AIAgent) {
    return {
      ok: false,
      failure: { phase: 'validate', message: 'Il task agente non è un AI Agent.' },
    };
  }

  const cfg = resolveTaskIaConfig(agentTask);
  if (cfg.platform !== 'elevenlabs') {
    return {
      ok: false,
      failure: {
        phase: 'validate',
        message: 'Sync ElevenLabs: imposta piattaforma ElevenLabs nel runtime IA dell’agente.',
      },
    };
  }

  const newName = String(params.newAgentName ?? '').trim();
  let agentId = String(params.agentId ?? '').trim();
  if (!newName && !agentId) {
    return {
      ok: false,
      failure: {
        phase: 'validate',
        message: 'Inserisci il nome del nuovo agente oppure seleziona un agente esistente.',
      },
    };
  }

  const backendIds = resolveBackendTaskIds(params);
  const useDevTunnelForWebhook = params.useDevTunnelForWebhook !== false;
  const tunnelReadiness = collectConvaiWebhookTunnelReadinessForSync({
    ...params,
    useDevTunnelForWebhook,
  });
  if (useDevTunnelForWebhook && !tunnelReadiness.ready) {
    return {
      ok: false,
      failure: {
        phase: 'validate',
        message: tunnelReadiness.errors[0] ?? 'Tunnel dev mancante per webhook ConvAI.',
        compileErrors: tunnelReadiness.errors.length > 1 ? tunnelReadiness.errors : undefined,
      },
    };
  }

  const allCompileErrors: string[] = [];
  for (const bid of backendIds) {
    const bt = taskRepository.getTask(bid);
    if (!bt || bt.type !== TaskType.BackendCall) {
      return {
        ok: false,
        failure: {
          phase: 'validate',
          message: `Backend catalogo «${bid}» non trovato o non è un Backend Call.`,
          backendTaskId: bid,
        },
      };
    }
    allCompileErrors.push(...openApiCompileErrorsFromTask(bt));
  }
  if (allCompileErrors.length > 0) {
    return {
      ok: false,
      failure: {
        phase: 'validate',
        message:
          'Spec incompleta su uno o più backend: correggi OpenAPI (Check Update) prima di aggiornare l’agente.',
        compileErrors: allCompileErrors,
      },
    };
  }

  let kbResolved: ResolvedKbForSync[];
  try {
    kbResolved = await resolveKbTextsForConvaiSync(params);
  } catch (e) {
    return {
      ok: false,
      failure: {
        phase: 'upload_kb',
        message: e instanceof Error ? e.message : String(e),
      },
    };
  }

  const kbDocs = listKbDocumentsForConvaiUpload(params.knowledgeBaseDocuments);
  const kbSkipped = kbDocs
    .filter((doc) => !kbResolved.some((r) => r.doc.id === doc.id))
    .map((d) => d.name);

  let promptText: string;
  try {
    promptText = buildSyncPromptText(params, kbResolved);
  } catch (e) {
    return {
      ok: false,
      failure: {
        phase: 'build_prompt',
        message: e instanceof Error ? e.message : String(e),
      },
    };
  }
  if (!promptText) {
    return {
      ok: false,
      failure: {
        phase: 'build_prompt',
        message:
          'Prompt agente vuoto. Compila use case, backend o knowledge base prima di aggiornare l’agente.',
      },
    };
  }

  const tools: ConvaiAgentSyncToolResult[] = [];
  const projectId = String(params.projectId ?? '').trim();
  const agentTaskId = String(agentTask.id ?? '').trim();
  for (const bid of backendIds) {
    const bt = taskRepository.getTask(bid)!;
    const built = prepareConvaiWebhookToolForElevenLabsApi({
      backendTask: bt,
      projectId,
      agentTaskId,
      useDevTunnel: useDevTunnelForWebhook,
    });
    if (!built.ok) {
      return {
        ok: false,
        failure: { phase: 'build_tool', message: built.error, backendTaskId: bid },
      };
    }
    try {
      const toolId = await createConvaiTool(built.tool);
      tools.push({
        backendTaskId: bid,
        toolId,
        toolName: String(built.tool.name ?? '').trim() || toolId,
      });
    } catch (e) {
      return {
        ok: false,
        failure: {
          phase: 'create_tool',
          message: e instanceof Error ? e.message : String(e),
          backendTaskId: bid,
        },
      };
    }
  }

  if (usesBookFromAgenda(tools, backendIds)) {
    promptText = `${promptText}\n\n${BOOK_FROM_AGENDA_PROMPT_APPEND}`;
  }

  const kbRefs: { type: string; name: string; id: string; usage_mode: string }[] = [];
  for (const { doc, text } of kbResolved) {
    try {
      const created = await createConvaiKbDocumentFromText({ name: doc.name, text });
      kbRefs.push({
        type: 'text',
        name: created.name,
        id: created.id,
        usage_mode: 'auto',
      });
    } catch (e) {
      return {
        ok: false,
        failure: {
          phase: 'upload_kb',
          message: e instanceof Error ? e.message : String(e),
        },
      };
    }
  }

  if (kbDocs.length > 0 && kbRefs.length === 0) {
    const hint =
      kbSkipped.length > 0
        ? ` Nessun testo recuperabile per: ${kbSkipped.slice(0, 5).join(', ')}${kbSkipped.length > 5 ? '…' : ''}. Completa l’analisi del documento o ricarica il file nella Knowledge Base (repository progetto).`
        : ' Verifica parseStatus «ready» e repositoryDocumentId sui file KB.';
    return {
      ok: false,
      failure: {
        phase: 'upload_kb',
        message: `Sync ElevenLabs: ${kbDocs.length} documenti KB in Omnia ma 0 caricati su ElevenLabs.${hint}`,
      },
    };
  }

  const adv = cfg.advanced ?? {};
  const llm =
    adv.llm && typeof adv.llm === 'object' && !Array.isArray(adv.llm)
      ? (adv.llm as Record<string, unknown>)
      : {};
  const lang = resolveConvaiAgentLanguageForSync(cfg.voice?.language);
  const llmModel = mapConvaiLlmForAgentLanguage(
    lang,
    typeof llm.model === 'string' && llm.model.trim() ? llm.model.trim() : 'gpt-4o'
  );

  const prompt: Record<string, unknown> = {
    prompt: promptText,
    llm: llmModel,
    tool_ids: tools.map((t) => t.toolId),
    knowledge_base: kbRefs,
  };
  if (typeof llm.temperature === 'number' && !Number.isNaN(llm.temperature)) {
    prompt.temperature = llm.temperature;
  }
  if (typeof llm.max_tokens === 'number' && llm.max_tokens > 0) {
    prompt.max_tokens = Math.floor(llm.max_tokens);
  }

  const immediateStart = agentTask.agentImmediateStart === true;
  const startUseCaseId = String(agentTask.agentStartUseCaseId ?? '').trim();
  const startSpeech = startUseCaseId
    ? resolveStartUseCaseSpeechText(params.useCases, startUseCaseId)
    : resolveAgentStartPromptSpeechText(
        parseAgentStartPromptJson(String(agentTask.agentStartPromptJson ?? ''))
      );
  const conversationConfig: Record<string, unknown> = {
    agent: {
      first_message: immediateStart
        ? ''
        : startSpeech || CONVAI_DEFAULT_FIRST_MESSAGE,
      language: lang,
      prompt,
    },
  };

  const tts = buildConvaiTtsBlockForApi(cfg, lang, { voiceId: primaryVoiceId(cfg) });
  if (tts) conversationConfig.tts = tts;

  const outbound =
    conversationConfigForConvaiApi(conversationConfig) ?? conversationConfig;

  if (newName) {
    try {
      const created = await createConvaiAgentViaOmniaServer({
        name: newName,
        conversation_config: outbound,
      });
      agentId = created.agentId;
    } catch (e) {
      return {
        ok: false,
        failure: {
          phase: 'create_agent',
          message: e instanceof Error ? e.message : String(e),
        },
      };
    }
  } else {
    try {
      await patchConvaiAgent(agentId, { conversation_config: outbound });
    } catch (e) {
      return {
        ok: false,
        failure: {
          phase: 'patch_agent',
          message: e instanceof Error ? e.message : String(e),
        },
      };
    }
  }

  return {
    ok: true,
    result: {
      agentId,
      promptCharCount: promptText.length,
      tools,
      kbDocumentIds: kbRefs.map((k) => k.id),
      kbCandidateCount: kbDocs.length,
      kbUploadedCount: kbRefs.length,
    },
  };
}
