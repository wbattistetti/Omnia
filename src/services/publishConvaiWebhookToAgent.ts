/**
 * Pubblica un Backend Call come tool webhook inline sull’agente ConvAI (nessun POST workspace).
 */

import type { Task } from '@types/taskTypes';
import { openApiCompileErrorsFromTask } from '@domain/openApi/openApiCompileErrorsFromTask';
import { prepareConvaiWebhookToolForElevenLabsApi } from '@utils/iaAgentRuntime/prepareConvaiWebhookToolForElevenLabsApi';
import { upsertInlineWebhookToolOnAgent } from '@utils/iaAgentRuntime/convaiInlineAgentTools';
import { createConvaiAgentViaOmniaServer } from '@services/convaiProvisionApi';

export type PublishConvaiWebhookResult = {
  /** Id backend Omnia (tool inline, non workspace tool_id). */
  toolId: string;
  agentId: string;
  toolName: string;
};

export type PublishConvaiWebhookFailure = {
  phase: 'validate' | 'create_agent' | 'build' | 'attach';
  message: string;
  compileErrors?: string[];
};

/**
 * Aggiorna `prompt.tools` sull’agente con il webhook del Backend Call.
 */
export async function publishConvaiWebhookToAgent(params: {
  backendTask: Task;
  projectId?: string;
  agentTaskId?: string;
  agentId?: string;
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

  const built = prepareConvaiWebhookToolForElevenLabsApi({
    backendTask: params.backendTask,
    projectId: String(params.projectId ?? '').trim(),
    agentTaskId: String(params.agentTaskId ?? '').trim(),
  });
  if (!built.ok) {
    return { ok: false, failure: { phase: 'build', message: built.error } };
  }

  const toolName = String(built.tool.name ?? '').trim() || 'webhook';
  const backendTaskId = String(params.backendTask.id ?? '').trim();

  try {
    await upsertInlineWebhookToolOnAgent(agentId, built.tool);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      failure: {
        phase: 'attach',
        message: msg || 'Aggiornamento tool inline sull’agente fallito.',
      },
    };
  }

  return {
    ok: true,
    result: { toolId: backendTaskId || toolName, agentId, toolName },
  };
}
