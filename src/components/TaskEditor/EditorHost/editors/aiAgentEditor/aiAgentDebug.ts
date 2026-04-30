/**
 * Optional diagnostics for AI Agent persistence.
 * Enable: localStorage.setItem('debug.aiAgent', '1')
 * Persist (use cases + dialogues written to TaskRepository): also
 * localStorage.setItem('debug.aiAgent.persist', '1') — or use debug.aiAgent alone (includes persist summary).
 */

import type { AIAgentUseCase } from '@types/aiAgentUseCases';
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
    agentImmediateStart: t.agentImmediateStart === true,
  };
}

/**
 * Logs a payload only when {@link isAiAgentDebugEnabled} is true.
 */
export function logAiAgentDebug(event: string, payload: unknown): void {
  if (!isAiAgentDebugEnabled()) return;
  console.log(`[AIAgentDebug] ${event}`, payload);
}

/**
 * True when persist-to-repository logs (use cases + dialogues) should print.
 */
export function shouldLogAiAgentPersistUseCases(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return (
      window.localStorage.getItem('debug.aiAgent') === '1' ||
      window.localStorage.getItem('debug.aiAgent.persist') === '1'
    );
  } catch {
    return false;
  }
}

/**
 * Counts use cases and dialogue turns for persist verification logs.
 */
export function summarizeUseCasesForPersistLog(useCases: readonly AIAgentUseCase[]): {
  useCaseCount: number;
  totalDialogueTurns: number;
  perUseCase: Array<{ id: string; labelPreview: string; dialogueTurns: number }>;
} {
  const perUseCase = useCases.map((u) => ({
    id: u.id,
    labelPreview: (u.label ?? '').slice(0, 48),
    dialogueTurns: Array.isArray(u.dialogue) ? u.dialogue.length : 0,
  }));
  return {
    useCaseCount: useCases.length,
    totalDialogueTurns: perUseCase.reduce((n, r) => n + r.dialogueTurns, 0),
    perUseCase,
  };
}

/**
 * Logs when agent state (including serialized use cases / dialogues) is written to TaskRepository.
 */
export function logAiAgentPersistUseCases(event: string, payload: Record<string, unknown>): void {
  if (!shouldLogAiAgentPersistUseCases()) return;
  console.log(`[AIAgentPersist] ${event}`, payload);
}
