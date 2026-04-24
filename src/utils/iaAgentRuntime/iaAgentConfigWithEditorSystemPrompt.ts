/**
 * Per ConvAI `createAgent`: arricchisce {@link IAAgentConfig} con il testo rules/prompt dell’editor AI Agent
 * (`rulesStringForCompilerFromTaskFields` = runtime_compact deterministico, fallback `agentPrompt`).
 */

import type { IAAgentConfig } from 'types/iaAgentRuntimeSetup';
import type { Task } from '@types/taskTypes';
import {
  rulesStringForCompilerFromTaskFields,
  type AiAgentTaskFieldsForCompiler,
} from '@components/TaskEditor/EditorHost/editors/aiAgentEditor/composeRuntimeRulesFromCompact';

/**
 * Restituisce una copia di `cfg` con `systemPrompt` = blocco testo usato per la compile VB (stesso criterio dell’editor),
 * se il task fornisce contenuto non vuoto.
 */
export function iaAgentConfigWithEditorSystemPrompt(cfg: IAAgentConfig, task: Task | null): IAAgentConfig {
  if (!task) return cfg;
  const fields: AiAgentTaskFieldsForCompiler = {
    agentRuntimeCompactJson: task.agentRuntimeCompactJson,
    agentPrompt: task.agentPrompt,
  };
  const fromEditor = rulesStringForCompilerFromTaskFields(fields).trim();
  if (!fromEditor) return cfg;
  return { ...cfg, systemPrompt: fromEditor };
}
