/**
 * Optional diagnostics for AI Agent persistence.
 * Enable: localStorage.setItem('debug.aiAgent', '1')
 */

import type { Task } from '@types/taskTypes';

/**
 * Returns true when debug logging for AI Agent persistence is enabled.
 */
export function isAiAgentDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem('debug.aiAgent') === '1';
  } catch {
    return false;
  }
}

/**
 * Compact summary of agent* fields on a task row (for console inspection).
 */
export function summarizeAgentTaskFields(task: Task | null | undefined): Record<string, unknown> {
  if (!task) return { missing: true };
  const t = task as Record<string, unknown>;
  return {
    id: t.id,
    type: t.type,
    agentDesignDescriptionLen: String(t.agentDesignDescription ?? '').length,
    agentPromptLen: String(t.agentPrompt ?? '').length,
    agentStructuredSectionsJsonLen: String(t.agentStructuredSectionsJson ?? '').length,
    agentUseCasesJsonLen: String(t.agentUseCasesJson ?? '').length,
    agentLogicalStepsJsonLen: String(t.agentLogicalStepsJson ?? '').length,
    agentProposedFieldsCount: Array.isArray(t.agentProposedFields) ? (t.agentProposedFields as unknown[]).length : 0,
    agentDesignHasGeneration: t.agentDesignHasGeneration,
  };
}

/**
 * Logs a payload only when {@link isAiAgentDebugEnabled} is true.
 */
export function logAiAgentDebug(event: string, payload: unknown): void {
  if (!isAiAgentDebugEnabled()) return;
  console.log(`[AIAgentDebug] ${event}`, payload);
}
