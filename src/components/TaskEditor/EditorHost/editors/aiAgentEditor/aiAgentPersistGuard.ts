/**
 * Safety net: detects when a persist patch would clear meaningful agent fields that still exist in TaskRepository.
 * Primary persistence is gated by hydrated + dirty in useAIAgentEditorController; this catches edge cases only.
 */

import { taskRepository } from '@services/TaskRepository';
import type { Task } from '@types/taskTypes';

/** True for non-empty plain text (trimmed). */
export function nonEmpty(value: unknown): boolean {
  return String(value ?? '').trim().length > 0;
}

/**
 * True when the string looks like meaningful persisted JSON (not placeholder empty values).
 * Returns false for: '', '[]', '{}', 'null', 'undefined' (string forms).
 */
export function nonEmptyJsonish(value: unknown): boolean {
  const s = String(value ?? '').trim();
  if (!s) return false;
  if (s === '[]' || s === '{}' || s === 'null' || s === 'undefined') return false;
  return true;
}

/**
 * True if applying `patch` would downgrade any meaningful agent field from non-empty to empty vs. `existing` in the repo.
 */
export function wouldDowngradeAgentPersistPatch(instanceId: string, patch: Record<string, unknown>): boolean {
  const existing = taskRepository.getTask(instanceId) as Task | null;
  if (!existing) return false;

  const ex = existing as Record<string, unknown>;

  if (nonEmpty(ex.agentDesignDescription) && !nonEmpty(patch.agentDesignDescription)) return true;
  if (nonEmpty(ex.agentPrompt) && !nonEmpty(patch.agentPrompt)) return true;
  if (nonEmptyJsonish(ex.agentUseCasesJson) && !nonEmptyJsonish(patch.agentUseCasesJson)) return true;
  if (nonEmptyJsonish(ex.agentLogicalStepsJson) && !nonEmptyJsonish(patch.agentLogicalStepsJson)) return true;
  if (nonEmptyJsonish(ex.agentStructuredSectionsJson) && !nonEmptyJsonish(patch.agentStructuredSectionsJson)) {
    return true;
  }

  const prevProposed = Array.isArray(ex.agentProposedFields) ? ex.agentProposedFields.length : 0;
  const nextProposed = Array.isArray(patch.agentProposedFields) ? patch.agentProposedFields.length : 0;
  if (prevProposed > 0 && nextProposed === 0) return true;

  if (ex.agentDesignHasGeneration === true && patch.agentDesignHasGeneration !== true) return true;

  return false;
}
