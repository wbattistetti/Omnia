/**
 * Tool webhook inline `omnia_dialog_step` per ElevenLabs ConvAI (deploy deterministico).
 */

import {
  buildOmniaDialogStepUrl,
  resolveOmniaRuntimeOrigin,
} from '@domain/convaiRuntime/convaiWebhookGatewayUrl';
import { toElevenLabsRequestBodySchema } from '@domain/openApi/adaptOpenApiJsonSchemaToElevenLabsToolSchema';

export const OMNIA_DIALOG_STEP_TOOL_NAME = 'omnia_dialog_step';

const REQUEST_SCHEMA = {
  type: 'object',
  required: ['conversationId'],
  properties: {
    conversationId: {
      type: 'string',
      description: 'ID conversazione runtime (omnia_conversation_id).',
    },
    updates: {
      type: 'object',
      additionalProperties: { type: 'string' },
      description: 'Slot NLU → valore scelto dall’utente nel turno corrente.',
    },
    kbDocumentId: {
      type: 'string',
      description: 'Documento KB specifico; opzionale se c’è un solo documento approvato.',
    },
    reset: {
      type: 'boolean',
      description: 'True per azzerare la sessione dialogo prima del passo.',
    },
  },
} as const;

export type BuildOmniaDialogStepConvaiToolParams = {
  projectId: string;
  agentTaskId: string;
  gatewayOrigin?: string;
};

/** Payload tool webhook ElevenLabs per omnia_dialog_step. */
export function buildOmniaDialogStepConvaiTool(
  params: BuildOmniaDialogStepConvaiToolParams
): Record<string, unknown> {
  const projectId = String(params.projectId ?? '').trim();
  const agentTaskId = String(params.agentTaskId ?? '').trim();
  const origin = resolveOmniaRuntimeOrigin(params.gatewayOrigin);
  const url = buildOmniaDialogStepUrl({ origin, projectId, agentTaskId });
  const description =
    'Passo dialogo KB deterministico Omnia: restituisce `say` da leggere all’utente e gestisce filtro tabella.';

  return {
    type: 'webhook',
    name: OMNIA_DIALOG_STEP_TOOL_NAME,
    description,
    api_schema: {
      url,
      method: 'POST',
      request_body_schema: toElevenLabsRequestBodySchema(
        REQUEST_SCHEMA as unknown as Record<string, unknown>,
        { description }
      ),
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
