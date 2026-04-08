/**
 * Per-project FIFO: one structural command runs at a time to avoid graph/repo/store races.
 */

const tail = new Map<string, Promise<unknown>>();

export function enqueueStructuralForProject<T>(projectId: string, task: () => Promise<T>): Promise<T> {
  const pid = String(projectId || '').trim();
  if (!pid) return task();
  const prev = tail.get(pid) ?? Promise.resolve();
  const current = prev.then(() => task());
  tail.set(
    pid,
    current.then(
      () => undefined,
      () => undefined
    )
  );
  return current;
}
