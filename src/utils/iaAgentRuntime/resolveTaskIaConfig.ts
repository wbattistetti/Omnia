/**
 * Effective IA runtime config for a task: saved override merged with global defaults.
 */

import type { Task } from '@types/taskTypes';
import type { IAAgentConfig } from 'types/iaAgentRuntimeSetup';
import {
  mergeConvaiAgentIdFromGlobalDefaults,
  normalizeIAAgentConfig,
  parseOptionalIaRuntimeJson,
} from './iaAgentConfigNormalize';
import { loadGlobalIaAgentConfig } from './globalIaAgentPersistence';

/** Override JSON on task > global defaults; ConvAI id may be inherited from globals. */
export function resolveTaskIaConfig(task: Task): IAAgentConfig {
  const globals = loadGlobalIaAgentConfig();
  const parsed = parseOptionalIaRuntimeJson(task.agentIaRuntimeOverrideJson);
  const merged = normalizeIAAgentConfig(parsed ?? globals);
  return mergeConvaiAgentIdFromGlobalDefaults(merged, globals);
}
