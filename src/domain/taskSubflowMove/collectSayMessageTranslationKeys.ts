/**
 * Collects flow translation store keys referenced by SayMessage-style task.parameters (text value)
 * across task.steps (dictionary or array shape) and escalations.
 */

import type { Task } from '@types/taskTypes';
import { translationKeyFromStoredValue } from '@utils/translationKeys';

function textParamTranslationKey(taskItem: { parameters?: unknown } | null | undefined): string | null {
  const params = taskItem?.parameters;
  if (!Array.isArray(params)) return null;
  const textParam = params.find(
    (p: { parameterId?: string; key?: string }) =>
      String(p?.parameterId || '').trim() === 'text' || String(p?.key || '').trim() === 'text'
  ) as { value?: unknown } | undefined;
  const raw = textParam?.value;
  return raw != null ? translationKeyFromStoredValue(String(raw)) : null;
}

function walkStepDict(stepDict: Record<string, unknown>, out: Set<string>): void {
  for (const step of Object.values(stepDict)) {
    if (!step || typeof step !== 'object') continue;
    const escalations = (step as { escalations?: unknown }).escalations;
    if (!Array.isArray(escalations)) continue;
    for (const escalation of escalations) {
      const tasks = (escalation as { tasks?: unknown }).tasks;
      if (!Array.isArray(tasks)) continue;
      for (const taskItem of tasks) {
        const tk = textParamTranslationKey(taskItem as { parameters?: unknown });
        if (tk) out.add(tk);
      }
    }
  }
}

/**
 * Returns canonical translation keys (e.g. `task:uuid`, `var:uuid`, `runtime.*`) used as SayMessage text pointers in `task.steps`.
 */
export function collectSayMessageTranslationKeysFromTask(task: Task | null | undefined): string[] {
  const out = new Set<string>();
  if (!task?.steps) return [];

  const steps = task.steps as unknown;
  if (Array.isArray(steps)) {
    for (const step of steps) {
      if (!step || typeof step !== 'object') continue;
      const escalations = (step as { escalations?: unknown }).escalations;
      if (!Array.isArray(escalations)) continue;
      for (const escalation of escalations) {
        const tasks = (escalation as { tasks?: unknown }).tasks;
        if (!Array.isArray(tasks)) continue;
        for (const taskItem of tasks) {
          const tk = textParamTranslationKey(taskItem as { parameters?: unknown });
          if (tk) out.add(tk);
        }
      }
    }
    return [...out];
  }

  if (typeof steps === 'object') {
    for (const stepDict of Object.values(steps as Record<string, unknown>)) {
      if (!stepDict || typeof stepDict !== 'object') continue;
      if (Array.isArray(stepDict)) {
        for (const step of stepDict) {
          if (!step || typeof step !== 'object') continue;
          const escalations = (step as { escalations?: unknown }).escalations;
          if (!Array.isArray(escalations)) continue;
          for (const escalation of escalations) {
            const tasks = (escalation as { tasks?: unknown }).tasks;
            if (!Array.isArray(tasks)) continue;
            for (const taskItem of tasks) {
              const tk = textParamTranslationKey(taskItem as { parameters?: unknown });
              if (tk) out.add(tk);
            }
          }
        }
        continue;
      }
      walkStepDict(stepDict as Record<string, unknown>, out);
    }
  }

  return [...out];
}
