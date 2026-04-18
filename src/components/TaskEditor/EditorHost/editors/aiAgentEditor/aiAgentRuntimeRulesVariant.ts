/**
 * Compile/runtime `rules` for AI Agent tasks: always distilled (`runtime_compact` join).
 * Legacy UI toggled distilled vs rich; product policy now fixes distilled in code.
 */

export type AiAgentRuntimeRulesVariant = 'distilled';

export function readAiAgentRuntimeRulesVariant(): AiAgentRuntimeRulesVariant {
  return 'distilled';
}

/** @deprecated No-op: variant is no longer user-configurable. */
export function writeAiAgentRuntimeRulesVariant(_v: AiAgentRuntimeRulesVariant): void {}
