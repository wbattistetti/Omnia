/**
 * Pubblica un Backend Call come tool webhook ConvAI su ElevenLabs e lo aggancia all’agente (tool_ids).
 */

import type { Task } from '@types/taskTypes';
import { openApiCompileErrorsFromTask } from '@domain/openApi/openApiCompileErrorsFromTask';
import { buildConvaiWebhookToolFromBackendTask } from '@utils/iaAgentRuntime/elevenLabsConvaiToolsPayload';
import { createConvaiAgentViaOmniaServer } from '@services/convaiProvisionApi';
import {
  appendConvaiToolToAgent,
  createConvaiTool,
} from '@workspaces/elevenlabs/api/convaiToolApi';

export type PublishConvaiWebhookResult = {
  toolId: string;
  agentId: string;
  toolName: string;
};

export type PublishConvaiWebhookFailure = {
  phase: 'validate' | 'create_agent' | 'build' | 'create' | 'attach';
  message: string;
  compileErrors?: string[];
};

/**
 * Crea il tool remoto e lo collega all’agente. Schema da OpenAPI materializzato sul task (nessun input manuale parametri).
 */
export async function publishConvaiWebhookToAgent(params: {
  backendTask: Task;
  /** Agente esistente (se `newAgentName` è vuoto). */
  agentId?: string;
  /** Se valorizzato, crea prima un nuovo agente ConvAI con questo nome. */
  newAgentName?: string;
}): Promise<
  | { ok: true; result: PublishConvaiWebhookResult }
  | { ok: false; failure: PublishConvaiWebhookFailure }
> {
  const newName = String(params.newAgentName ?? '').trim();
  let agentId = String(params.agentId ?? '').trim();

  if (newName) {
    try {
      const created = await createConvaiAgentViaOmniaServer({ name: newName });
      agentId = created.agentId;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        failure: {
          phase: 'create_agent',
          message: msg || 'Creazione agente ElevenLabs fallita.',
        },
      };
    }
  }

  if (!agentId) {
    return {
      ok: false,
      failure: {
        phase: 'validate',
        message: 'Inserisci il nome del nuovo agente oppure seleziona un agente esistente.',
      },
    };
  }

  const compileErrors = openApiCompileErrorsFromTask(params.backendTask);
  if (compileErrors.length > 0) {
    return {
      ok: false,
      failure: {
        phase: 'validate',
        message: 'Spec incompleta: correggi gli errori OpenAPI (Check Update) prima di pubblicare.',
        compileErrors,
      },
    };
  }

  const built = buildConvaiWebhookToolFromBackendTask(params.backendTask);
  if (!built.ok) {
    return { ok: false, failure: { phase: 'build', message: built.error } };
  }

  const toolName = String(built.tool.name ?? '').trim() || 'webhook';

  let toolId: string;
  try {
    toolId = await createConvaiTool(built.tool);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      failure: {
        phase: 'create',
        message: msg || 'Creazione tool ConvAI fallita.',
      },
    };
  }

  try {
    await appendConvaiToolToAgent(agentId, toolId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      failure: {
        phase: 'attach',
        message: `Tool creato (${toolId}) ma aggancio all’agente fallito: ${msg}`,
      },
    };
  }

  return {
    ok: true,
    result: { toolId, agentId, toolName },
  };
}
