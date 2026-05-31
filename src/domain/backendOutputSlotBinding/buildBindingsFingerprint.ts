/**
 * Fingerprint RECEIVE dei backend collegati all'agente (per rigenerare proposte binding).
 */

import type { Task } from '@types/taskTypes';
import { TaskType } from '@types/taskTypes';

export function buildBindingsFingerprint(
  backendTaskIds: readonly string[],
  getTask: (taskId: string) => Task | null | undefined
): string {
  const parts: string[] = [];
  const ids = [...new Set(backendTaskIds.map((x) => String(x ?? '').trim()).filter(Boolean))].sort();
  for (const id of ids) {
    const t = getTask(id);
    if (!t || t.type !== TaskType.BackendCall) continue;
    const ep = (t as Task & { endpoint?: { url?: string; method?: string } }).endpoint;
    const url = ep && typeof ep.url === 'string' ? ep.url.trim() : '';
    const method = ep && typeof ep.method === 'string' ? ep.method.trim() : '';
    const outputs = Array.isArray((t as Task & { outputs?: unknown[] }).outputs)
      ? (t as Task & { outputs: Array<{ apiField?: string }> }).outputs
      : [];
    const fields = outputs
      .map((o) => String(o.apiField ?? '').trim())
      .filter(Boolean)
      .sort();
    parts.push(`${id}|${method}|${url}|${fields.join(',')}`);
  }
  return parts.join('\n');
}
