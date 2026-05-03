/**
 * Builds compile/ConvAI rules text from full structured section bodies (no word-clipped compact join).
 * Matches toolbar “target platform” preview and {@link compileAgentPromptToPlatform}.
 * Per ConvAI, appende in **Context** (o sostituisce il placeholder `missing`) un riepilogo contrattuale dai Backend Call in `convaiBackendToolTaskIds`.
 */

import type { Task } from '@types/taskTypes';
import { TaskType } from '@types/taskTypes';
import { taskRepository } from '@services/TaskRepository';
import {
  AgentPlatform,
  buildAgentStructuredSections,
  compileAgentPromptToPlatform,
  normalizeAgentPromptPlatformId,
} from '@domain/agentPrompt';
import { deriveExportedToolName } from '@domain/iaAgentTools/backendToolDerivation';
import { mergeConvaiBackendToolIdLists } from '@domain/iaAgentTools/manualCatalogBackendToolIds';
import { parsePersistedStructuredSectionsJson } from './structuredSectionPersist';
import { effectiveBySectionFromPersistedStructured } from './structuredSectionsRevisionReducer';

export type TaskLikeForPlatformRules = Pick<
  Task,
  'agentStructuredSectionsJson' | 'agentPrompt' | 'agentPromptTargetPlatform'
>;

function structuredSectionsToIr(task: TaskLikeForPlatformRules) {
  const parsed = parsePersistedStructuredSectionsJson(
    task.agentStructuredSectionsJson,
    task.agentPrompt ?? ''
  );
  const eff = effectiveBySectionFromPersistedStructured(parsed.sections);
  return buildAgentStructuredSections(
    {
      goal: eff.goal ?? '',
      operational_sequence: eff.operational_sequence ?? '',
      context: eff.context ?? '',
      constraints: eff.constraints ?? '',
      personality: eff.personality ?? '',
      tone: eff.tone ?? '',
      examples: eff.examples ?? '',
    },
    parsed.backendPlaceholders
  );
}

/** VB compile `rules` + runtime preview: same shape as Prompt finale for selected platform. */
export function resolveAiAgentPlatformRulesString(task: TaskLikeForPlatformRules): string {
  const ir = structuredSectionsToIr(task);
  const platform = normalizeAgentPromptPlatformId(task.agentPromptTargetPlatform);
  return compileAgentPromptToPlatform(ir, platform);
}

export type ResolveElevenLabsAgentPromptOptions = {
  manualCatalogBackendTaskIds?: readonly string[];
};

function buildConvaiBackendToolContractAppendix(
  task: TaskLikeForPlatformRules & { agentIaRuntimeOverrideJson?: string | null },
  manualCatalogBackendTaskIds: readonly string[] | undefined
): string {
  const raw = task.agentIaRuntimeOverrideJson;
  let parsed: Record<string, unknown> | null = null;
  if (typeof raw === 'string' && raw.trim()) {
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      parsed = null;
    }
  }
  const fromJson = parsed && Array.isArray(parsed.convaiBackendToolTaskIds) ? parsed.convaiBackendToolTaskIds : [];
  const idsCombined = mergeConvaiBackendToolIdLists(
    fromJson.map((x) => String(x ?? '').trim()).filter(Boolean),
    manualCatalogBackendTaskIds ?? []
  );
  if (idsCombined.length === 0) return '';
  const chunks: string[] = [];
  for (const x of idsCombined) {
    const tid = String(x ?? '').trim();
    if (!tid) continue;
    const bt = taskRepository.getTask(tid);
    if (!bt || bt.type !== TaskType.BackendCall) continue;
    const name = deriveExportedToolName(bt);
    const label = String((bt as Task).label ?? '').trim();
    const desc = String((bt as Task).backendToolDescription ?? '').trim();
    const head = `**Tool \`${name}\`**${label ? ` (${label})` : ''}`;
    const body = desc || '_Aggiungi «Descrizione per ConvAI» sul Backend Call per il contratto d’uso._';
    chunks.push(`${head}\n${body}`);
  }
  if (!chunks.length) return '';
  return ['#### Contratto tool backend (ConvAI)', '', ...chunks].join('\n\n');
}

/** ConvAI `conversation_config.agent.prompt.prompt`: ElevenLabs compile of full sections (cloud agent target). */
export function resolveElevenLabsAgentPromptFromTask(
  task: TaskLikeForPlatformRules & { agentIaRuntimeOverrideJson?: string | null },
  options?: ResolveElevenLabsAgentPromptOptions
): string {
  const ir = structuredSectionsToIr(task);
  const appendix = buildConvaiBackendToolContractAppendix(task, options?.manualCatalogBackendTaskIds);
  const ctxRaw = (ir.context ?? '').trim();
  let context = ctxRaw;
  if (appendix) {
    if (!ctxRaw || /^missing$/i.test(ctxRaw)) {
      context = appendix;
    } else {
      context = `${ctxRaw}\n\n${appendix}`;
    }
  }
  return compileAgentPromptToPlatform({ ...ir, context }, AgentPlatform.ElevenLabs);
}
