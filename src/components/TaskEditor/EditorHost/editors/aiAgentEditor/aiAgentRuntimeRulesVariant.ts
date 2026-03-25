/**
 * Persists AI Agent compile/runtime `rules` mode (distilled compact vs rich Markdown) for dialogue debug.
 * Shared via localStorage so DialogueEngine compile matches the toolbar selection without prop drilling.
 */

export type AiAgentRuntimeRulesVariant = 'distilled' | 'rich';

const STORAGE_KEY = 'omnia.aiAgent.runtimeRulesVariant';

export function readAiAgentRuntimeRulesVariant(): AiAgentRuntimeRulesVariant {
  try {
    if (typeof localStorage === 'undefined') return 'distilled';
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'rich' ? 'rich' : 'distilled';
  } catch {
    return 'distilled';
  }
}

export function writeAiAgentRuntimeRulesVariant(v: AiAgentRuntimeRulesVariant): void {
  try {
    localStorage.setItem(STORAGE_KEY, v);
  } catch {
    /* ignore quota / private mode */
  }
}
