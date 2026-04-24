/**
 * Registers AI Agent editors that must flush deterministic `runtime_compact` (Phase 2)
 * before flow compilation / debugger sessions read TaskRepository.
 */

const flushers = new Set<() => void>();

export function registerAiAgentPromptAlignmentFlush(flush: () => void): () => void {
  flushers.add(flush);
  return () => {
    flushers.delete(flush);
  };
}

/** Invokes all mounted AI Agent alignment flushes synchronously (before compile POST). */
export function flushAiAgentPromptAlignmentBeforeCompile(): void {
  flushers.forEach((f) => f());
}
