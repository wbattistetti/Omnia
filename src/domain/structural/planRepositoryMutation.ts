/**
 * Placeholder for explicit repository mutation plans before apply.
 * Task authoring patches currently run inside `materializeMovedTaskForSubflow` / TaskRepository.updateTask.
 */

export type RepositoryMutationPlan = { kind: 'none' };

export function emptyRepositoryPlan(): RepositoryMutationPlan {
  return { kind: 'none' };
}
