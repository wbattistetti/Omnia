/**
 * Tool webhook inline `omnia_dialog_step` per ElevenLabs ConvAI (deploy deterministico).
 */

import {
  buildOmniaDialogStepUrl,
  resolveOmniaDialogStepRuntimeOrigin,
} from '@domain/convaiRuntime/convaiWebhookGatewayUrl';
import { toElevenLabsRequestBodySchema } from '@domain/openApi/adaptOpenApiJsonSchemaToElevenLabsToolSchema';

export const OMNIA_DIALOG_STEP_TOOL_NAME = 'omnia_dialog_step';

function buildUpdatesRequestSchema(slotColumnIds: readonly string[]): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  for (const slotId of slotColumnIds) {
    const key = String(slotId ?? '').trim();
    if (!key) continue;
    properties[key] = {
      type: 'string',
      description: `Valore normalizzato per lo slot \`${key}\` dall'utterance utente corrente.`,
    };
  }
  return {
    type: 'object',
    properties,
    additionalProperties: { type: 'string' },
    description:
      slotColumnIds.length > 0
        ? 'Slot NLU → valore dal turno corrente. Dopo ogni risposta utente: almeno una chiave valorizzata. Solo `{}` al bootstrap o con reset.'
        : 'Slot NLU → valore scelto dall’utente nel turno corrente. Dopo la risposta utente, obbligatorio: `{ "<nextColumnId>": "<valore>" }`. Solo `{}` al primo passo dialogo KB o con reset.',
  };
}

function buildRequestSchema(slotColumnIds: readonly string[]): Record<string, unknown> {
  return {
    type: 'object',
    required: ['conversationId'],
    properties: {
      conversationId: {
        type: 'string',
        description: 'ID conversazione runtime (omnia_conversation_id).',
      },
      updates: buildUpdatesRequestSchema(slotColumnIds),
      kbDocumentId: {
        type: 'string',
        description: 'Documento KB specifico; opzionale se c’è un solo documento approvato.',
      },
      reset: {
        type: 'boolean',
        description: 'True per azzerare la sessione dialogo prima del passo.',
      },
    },
  };
}

export type BuildOmniaDialogStepConvaiToolParams = {
  projectId: string;
  agentTaskId: string;
  gatewayOrigin?: string;
  /** Chiavi slot selector KB per schema `updates` esplicito (ElevenLabs tool tester + LLM). */
  slotColumnIds?: readonly string[];
};

/** Payload tool webhook ElevenLabs per omnia_dialog_step. */
export function buildOmniaDialogStepConvaiTool(
  params: BuildOmniaDialogStepConvaiToolParams
): Record<string, unknown> {
  const projectId = String(params.projectId ?? '').trim();
  const agentTaskId = String(params.agentTaskId ?? '').trim();
  const origin = resolveOmniaDialogStepRuntimeOrigin(params.gatewayOrigin);
  const url = buildOmniaDialogStepUrl({ origin, projectId, agentTaskId });
  const slotColumnIds = (params.slotColumnIds ?? []).map((x) => String(x ?? '').trim()).filter(Boolean);
  const description =
    'Passo dialogo KB deterministico Omnia: restituisce `say` da leggere all’utente e gestisce filtro tabella. ' +
    'Bootstrap: `updates: {}`. Dopo ogni risposta utente: POST obbligatorio con `updates` valorizzato; non richiamare con `updates` vuoti se l’utente ha già risposto.';

  const requestSchema = buildRequestSchema(slotColumnIds);

  return {
    type: 'webhook',
    name: OMNIA_DIALOG_STEP_TOOL_NAME,
    description,
    api_schema: {
      url,
      method: 'POST',
      request_body_schema: toElevenLabsRequestBodySchema(requestSchema, { description }),
    },
    response_timeout_secs: 20,
  };
}

/** True se il tool inline è omnia_dialog_step. */
export function isOmniaDialogStepConvaiTool(tool: Record<string, unknown>): boolean {
  return String(tool.name ?? '').trim() === OMNIA_DIALOG_STEP_TOOL_NAME;
}

function setSchemaPropertyEnum(
  properties: Record<string, unknown>,
  required: Set<string>,
  key: string,
  values: unknown[]
): void {
  const prev =
    properties[key] && typeof properties[key] === 'object' && !Array.isArray(properties[key])
      ? (properties[key] as Record<string, unknown>)
      : {};
  properties[key] = {
    ...prev,
    type: 'string',
    enum: values,
  };
  required.add(key);
}

/**
 * Cabla conversationId runtime sul tool omnia_dialog_step (come BookFromAgenda).
 */
export function enforceOmniaDialogStepRuntimeToolPolicy(
  conversationConfigOutbound: Record<string, unknown>,
  sessionConversationId: string
): void {
  const agent = (conversationConfigOutbound.agent ?? null) as Record<string, unknown> | null;
  const prompt = (agent?.prompt ?? null) as Record<string, unknown> | null;
  const tools = Array.isArray(prompt?.tools) ? prompt!.tools : [];
  for (const tool of tools) {
    if (!tool || typeof tool !== 'object') continue;
    const t = tool as Record<string, unknown>;
    if (!isOmniaDialogStepConvaiTool(t)) continue;
    const apiSchema =
      t.api_schema && typeof t.api_schema === 'object' && !Array.isArray(t.api_schema)
        ? (t.api_schema as Record<string, unknown>)
        : null;
    if (!apiSchema) continue;
    const bodyOrQuery = apiSchema.request_body_schema as Record<string, unknown> | undefined;
    if (!bodyOrQuery || typeof bodyOrQuery !== 'object' || Array.isArray(bodyOrQuery)) continue;
    const properties =
      bodyOrQuery.properties && typeof bodyOrQuery.properties === 'object' && !Array.isArray(bodyOrQuery.properties)
        ? ({ ...(bodyOrQuery.properties as Record<string, unknown>) } as Record<string, unknown>)
        : ({} as Record<string, unknown>);
    const required = new Set<string>(
      Array.isArray(bodyOrQuery.required)
        ? bodyOrQuery.required.filter((x): x is string => typeof x === 'string')
        : []
    );
    setSchemaPropertyEnum(properties, required, 'conversationId', [sessionConversationId]);
    bodyOrQuery.properties = properties;
    bodyOrQuery.required = [...required];
  }
}

/**
 * Allinea conversationId del tool omnia_dialog_step alla sessione Test agente / Run corrente.
 * Necessario quando si riusa l’agente deployato (reuseDeployedConvaiAgent): senza patch il binding Redis resta vuoto → loop sulla prima domanda.
 */
export async function patchOmniaDialogStepSessionOnAgent(params: {
  agentId: string;
  sessionConversationId: string;
  projectId: string;
  agentTaskId: string;
  useDevTunnel?: boolean;
}): Promise<void> {
  const agentId = String(params.agentId ?? '').trim();
  const sessionConversationId = String(params.sessionConversationId ?? '').trim();
  const projectId = String(params.projectId ?? '').trim();
  const agentTaskId = String(params.agentTaskId ?? '').trim();
  if (!agentId || !sessionConversationId) {
    throw new Error('patchOmniaDialogStepSessionOnAgent: agentId e sessionConversationId obbligatori.');
  }

  const { getConvaiAgentDetail } = await import(
    '@workspaces/elevenlabs/api/convaiAgentApi'
  );
  const { rewriteCompilePayloadWithDevTunnel } = await import(
    '@domain/devTunnel/devTunnelCompileBridge'
  );
  const { mergeInlineWebhookToolsByName, readRawInlineToolsFromConversationConfig, patchConvaiAgentInlineWebhookTools } = await import(
    './convaiInlineAgentTools'
  );
  const { sanitizeConvaiWebhookToolForApi } = await import(
    '@domain/openApi/sanitizeConvaiWebhookToolForApi'
  );

  const detail = await getConvaiAgentDetail(agentId);
  const outbound = { ...detail.conversationConfig } as Record<string, unknown>;
  let tools = readRawInlineToolsFromConversationConfig(outbound);
  if (!tools.some(isOmniaDialogStepConvaiTool) && projectId && agentTaskId) {
    let dialogTool = buildOmniaDialogStepConvaiTool({ projectId, agentTaskId });
    if (params.useDevTunnel !== false) {
      dialogTool = rewriteCompilePayloadWithDevTunnel(dialogTool) as Record<string, unknown>;
    }
    tools = mergeInlineWebhookToolsByName(
      tools,
      sanitizeConvaiWebhookToolForApi(dialogTool)
    );
    const agent = (outbound.agent ?? {}) as Record<string, unknown>;
    const prompt = (agent.prompt ?? {}) as Record<string, unknown>;
    prompt.tools = tools;
    agent.prompt = prompt;
    outbound.agent = agent;
  }

  enforceOmniaDialogStepRuntimeToolPolicy(outbound, sessionConversationId);
  const patchedTools = readRawInlineToolsFromConversationConfig(outbound).map((t) =>
    sanitizeConvaiWebhookToolForApi(t)
  );
  await patchConvaiAgentInlineWebhookTools(agentId, patchedTools);
}
