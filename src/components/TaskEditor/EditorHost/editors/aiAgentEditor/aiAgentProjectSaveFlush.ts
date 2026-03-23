/**
 * Coordinates synchronous AI Agent editor → TaskRepository persistence before project-wide save.
 * Mounted editors register a flush callback; the save pipeline calls `flushAiAgentEditorsBeforeProjectSave`
 * before reading tasks, so Mongo payloads are not racing the debounced persist.
 */

const flushers = new Set<() => void>();

/**
 * Registers a flush to run before project save. Returns unregister (call on unmount).
 */
export function registerAiAgentProjectSaveFlush(flush: () => void): () => void {
  flushers.add(flush);
  return () => {
    flushers.delete(flush);
  };
}

/**
 * Invokes all registered flushes synchronously (e.g. from AppContent before `project:save`).
 */
export function flushAiAgentEditorsBeforeProjectSave(): void {
  flushers.forEach((f) => f());
}
