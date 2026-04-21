/**
 * Global default runtime IA agent config (all agents) — localStorage.
 */

import type { IAAgentConfig } from 'types/iaAgentRuntimeSetup';
import { getDefaultConfig } from './platformHelpers';
import { normalizeIAAgentConfig } from './iaAgentConfigNormalize';

const STORAGE_KEY = 'omnia.iaAgentGlobal.v1';

/**
 * Load persisted global config; on parse error returns OpenAI defaults.
 */
export function loadGlobalIaAgentConfig(): IAAgentConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultConfig('openai');
    const p = JSON.parse(raw) as unknown;
    return normalizeIAAgentConfig(p);
  } catch {
    return getDefaultConfig('openai');
  }
}

export function saveGlobalIaAgentConfig(config: IAAgentConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    throw new Error('Failed to persist global IA agent config to localStorage');
  }
}
