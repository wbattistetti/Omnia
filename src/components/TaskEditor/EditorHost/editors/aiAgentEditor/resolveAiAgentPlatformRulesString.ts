/**
 * Builds compile/ConvAI rules text from full structured section bodies (no word-clipped compact join).
 * Matches toolbar “target platform” preview and {@link compileAgentPromptToPlatform}.
 */

import type { Task } from '@types/taskTypes';
import {
  AgentPlatform,
  buildAgentStructuredSections,
  compileAgentPromptToPlatform,
  normalizeAgentPromptPlatformId,
} from '@domain/agentPrompt';
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

/** ConvAI `conversation_config.agent.prompt.prompt`: ElevenLabs compile of full sections (cloud agent target). */
export function resolveElevenLabsAgentPromptFromTask(task: TaskLikeForPlatformRules): string {
  const ir = structuredSectionsToIr(task);
  return compileAgentPromptToPlatform(ir, AgentPlatform.ElevenLabs);
}
