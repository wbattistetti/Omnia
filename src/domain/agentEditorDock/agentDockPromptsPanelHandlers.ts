/**
 * Dock context handlers required by {@link EditorUseCasesPanel} / {@link AIAgentUseCaseComposer} (Prompts tab).
 * Omnia task editor and review portal must expose the same keys (parity test).
 */

import type { AIAgentEditorDockContextValue } from '@components/TaskEditor/EditorHost/editors/aiAgentEditor/AIAgentEditorDockContext';
import type { AgentDockUseCaseInvalidationHandlers } from './useAgentDockUseCaseInvalidationHandlers';

/** Keys that must be wired for Prompts composer UI parity (Omnia ↔ review portal). */
export const AGENT_DOCK_PROMPTS_PANEL_HANDLER_KEYS = [
  'onUseCaseInvalidationNoteChange',
  'onUseCaseInvalidationStateChange',
  'onDeleteUseCase',
] as const satisfies readonly (keyof AIAgentEditorDockContextValue)[];

export type AgentDockPromptsPanelHandlerKey = (typeof AGENT_DOCK_PROMPTS_PANEL_HANDLER_KEYS)[number];

export type AgentDockPromptsPanelHandlers = Pick<
  AIAgentEditorDockContextValue,
  AgentDockPromptsPanelHandlerKey
>;

/** Maps shared invalidation handlers + delete into dock context fields. */
export function agentDockPromptsPanelHandlersFromInvalidation(
  invalidation: AgentDockUseCaseInvalidationHandlers,
  onDeleteUseCase: AIAgentEditorDockContextValue['onDeleteUseCase']
): AgentDockPromptsPanelHandlers {
  return {
    onUseCaseInvalidationNoteChange: invalidation.onUseCaseInvalidationNoteChange,
    onUseCaseInvalidationStateChange: invalidation.onUseCaseInvalidationStateChange,
    onDeleteUseCase,
  };
}

/** True when all Prompts-panel handler keys are non-null functions on the dock value. */
export function agentDockPromptsPanelHandlersComplete(
  dock: Partial<AIAgentEditorDockContextValue>
): boolean {
  for (const key of AGENT_DOCK_PROMPTS_PANEL_HANDLER_KEYS) {
    if (typeof dock[key] !== 'function') return false;
  }
  return true;
}
