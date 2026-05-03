/**
 * Per ConvAI `createAgent`: arricchisce {@link IAAgentConfig} con il testo rules/prompt dell’editor AI Agent
 * (full structured sections → ElevenLabs-shaped prompt, allineato a ConvAI createAgent).
 */

import type { IAAgentConfig } from 'types/iaAgentRuntimeSetup';
import type { Task } from '@types/taskTypes';
import { resolveElevenLabsAgentPromptFromTask } from '@components/TaskEditor/EditorHost/editors/aiAgentEditor/resolveAiAgentPlatformRulesString';

export type IaAgentConfigWithEditorSystemPromptOptions = {
  manualCatalogBackendTaskIds?: readonly string[];
};

/**
 * Restituisce una copia di `cfg` con `systemPrompt` = prompt ElevenLabs derivato dalle sezioni del task,
 * se il task fornisce contenuto non vuoto.
 */
export function iaAgentConfigWithEditorSystemPrompt(
  cfg: IAAgentConfig,
  task: Task | null,
  options?: IaAgentConfigWithEditorSystemPromptOptions
): IAAgentConfig {
  if (!task) return cfg;
  const fromEditor = resolveElevenLabsAgentPromptFromTask(task, {
    manualCatalogBackendTaskIds: options?.manualCatalogBackendTaskIds,
  }).trim();
  if (!fromEditor) return cfg;
  return { ...cfg, systemPrompt: fromEditor };
}
