/**
 * Builds compile/ConvAI rules text from full structured section bodies (no word-clipped compact join).
 * Matches toolbar “target platform” preview and {@link compileAgentPromptToPlatform}.
 * Per ConvAI, appende in **Context** (o sostituisce il placeholder `missing`) un riepilogo contrattuale dai Backend Call in `convaiBackendToolTaskIds`.
 */

import type { Task } from '@types/taskTypes';
import { TaskType } from '@types/taskTypes';
import type { ProjectBackendCatalogBlob } from '@domain/backendCatalog/catalogTypes';
import { taskRepository } from '@services/TaskRepository';
import {
  AgentPlatform,
  buildAgentStructuredSections,
  compileAgentPromptToPlatform,
  normalizeAgentPromptPlatformId,
} from '@domain/agentPrompt';
import {
  buildUseOfBackendsPromptSection,
  mergeUseOfBackendsIntoContext,
} from '@domain/backendAnalysis/buildUseOfBackendsPromptSection';
import { deriveExportedToolName } from '@domain/iaAgentTools/backendToolDerivation';
import { mergeConvaiBackendToolIdLists } from '@domain/iaAgentTools/manualCatalogBackendToolIds';
import { parsePersistedStructuredSectionsJson } from './structuredSectionPersist';
import { effectiveBySectionFromPersistedStructured } from './structuredSectionsRevisionReducer';
import { mergeUseCaseExamplesIntoExamplesBody } from '@utils/iaAgentRuntime/agentUseCasesProvisionPreviewFormat';
import {
  appendVirtualAgentCatalogToRulesString,
  buildVirtualAgentRuntimeCatalogFromUseCases,
} from '@domain/aiAgentUseCase/virtualAgentRuntimeCatalog';
import { parseAgentUseCasesJson } from '@types/aiAgentUseCases';

export type TaskLikeForPlatformRules = Pick<
  Task,
  'agentStructuredSectionsJson' | 'agentPrompt' | 'agentPromptTargetPlatform' | 'id'
> & {
  /** When set, append constrained use-case catalog (motor schemas) to compiled rules. */
  agentUseCasesJson?: string | null;
};

/** Task fields needed to merge use-case dialogues into the ConvAI Examples section. */
export type TaskLikeForElevenLabsPrompt = TaskLikeForPlatformRules &
  Pick<Task, 'agentUseCasesJson'> & { agentIaRuntimeOverrideJson?: string | null };

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
export type ResolvePlatformPromptOptions = {
  manualCatalogBackendTaskIds?: readonly string[];
  backendCatalog?: ProjectBackendCatalogBlob;
};

function applyUseOfBackendsToIrContext<T extends { context?: string }>(
  ir: T,
  task: TaskLikeForPlatformRules,
  options?: ResolvePlatformPromptOptions
): T {
  const agentTaskId = String(task.id ?? '').trim();
  if (!agentTaskId) return ir;
  const section = buildUseOfBackendsPromptSection({
    catalog: options?.backendCatalog,
    agentTaskId,
    manualCatalogBackendTaskIds: options?.manualCatalogBackendTaskIds,
  });
  if (!section) return ir;
  return {
    ...ir,
    context: mergeUseOfBackendsIntoContext(ir.context ?? '', section),
  };
}

/** VB compile `rules` + runtime preview: same shape as Prompt finale for selected platform. */
export function resolveAiAgentPlatformRulesString(
  task: TaskLikeForPlatformRules,
  options?: ResolvePlatformPromptOptions
): string {
  const ir = applyUseOfBackendsToIrContext(structuredSectionsToIr(task), task, options);
  const platform = normalizeAgentPromptPlatformId(task.agentPromptTargetPlatform);
  const base = compileAgentPromptToPlatform(ir, platform);
  return appendVirtualAgentCatalogToRulesString(base, task.agentUseCasesJson ?? undefined);
}

export type ResolveElevenLabsAgentPromptOptions = ResolvePlatformPromptOptions;

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
  task: TaskLikeForElevenLabsPrompt,
  options?: ResolveElevenLabsAgentPromptOptions
): string {
  const ir = structuredSectionsToIr(task);
  const parsedUseCases = parseAgentUseCasesJson(task.agentUseCasesJson);
  const motorCatalog = buildVirtualAgentRuntimeCatalogFromUseCases(parsedUseCases);
  /** Evita few-shot narrativo duplicato e in conflitto con il catalogo motor (appendix sotto). */
  const examplesMerged =
    motorCatalog.entries.length > 0
      ? ir.examples ?? ''
      : mergeUseCaseExamplesIntoExamplesBody(ir.examples ?? '', task);
  const irWithUseCases = { ...ir, examples: examplesMerged };

  let context = (irWithUseCases.context ?? '').trim();
  const useOfBackends = buildUseOfBackendsPromptSection({
    catalog: options?.backendCatalog,
    agentTaskId: String(task.id ?? '').trim(),
    manualCatalogBackendTaskIds: options?.manualCatalogBackendTaskIds,
  });
  if (useOfBackends) {
    context = mergeUseOfBackendsIntoContext(context, useOfBackends);
  } else {
    const appendix = buildConvaiBackendToolContractAppendix(task, options?.manualCatalogBackendTaskIds);
    if (appendix) {
      if (!context || /^missing$/i.test(context)) {
        context = appendix;
      } else {
        context = `${context}\n\n${appendix}`;
      }
    }
  }

  const elBase = compileAgentPromptToPlatform(
    { ...irWithUseCases, context },
    AgentPlatform.ElevenLabs
  );
  return appendVirtualAgentCatalogToRulesString(elBase, task.agentUseCasesJson ?? undefined);
}
