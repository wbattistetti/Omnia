/**
 * Unified load / persist for problem classification (embeddings editor): TaskRepository + localStorage.
 * Merge uses local persistedAt vs Task.updatedAt to resolve conflicts.
 */
import type { ProblemPayload, ProblemEditorState } from '../../../types/project';
import { normalizeProblemPayload } from '../../../utils/semanticValueClassificationBridge';
import { taskRepository } from '../../../services/TaskRepository';
import { ProjectDataService } from '../../../services/ProjectDataService';

export function getProblemClassificationStorageKey(projectId: string, instanceId: string): string {
  return `problem.${projectId}.${instanceId}`;
}

function getTaskUpdatedAtMs(instanceId: string): number {
  const task = taskRepository.getTask(instanceId);
  if (!task?.updatedAt) return 0;
  const u = task.updatedAt;
  if (u instanceof Date) return u.getTime();
  const n = new Date(u as string | number).getTime();
  return Number.isFinite(n) ? n : 0;
}

export function buildPayloadFromTaskRepository(instanceId: string): ProblemPayload {
  const taskInstance = taskRepository.getTask(instanceId);
  const parts: Record<string, unknown> = { version: 1 };
  if (taskInstance?.semanticValues && Array.isArray(taskInstance.semanticValues)) {
    parts.semanticValues = taskInstance.semanticValues;
  }
  if ((taskInstance as { problem?: unknown })?.problem) {
    const p = normalizeProblemPayload((taskInstance as { problem?: unknown }).problem);
    if (!(parts.semanticValues as unknown[])?.length && p.semanticValues?.length) {
      parts.semanticValues = p.semanticValues;
    }
    parts.editor = p.editor;
  }
  return normalizeProblemPayload(parts);
}

export function readPayloadFromLocalStorage(projectId: string, instanceId: string): ProblemPayload | null {
  if (typeof window === 'undefined') return null;
  try {
    const key = getProblemClassificationStorageKey(projectId, instanceId);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return normalizeProblemPayload(JSON.parse(raw));
  } catch {
    return null;
  }
}

function mergeEditorPrefer(primary: ProblemPayload, secondary: ProblemPayload): ProblemEditorState | undefined {
  const pt = primary.editor?.tests?.length ?? 0;
  const st = secondary.editor?.tests?.length ?? 0;
  if (pt > 0) return primary.editor;
  if (st > 0) return secondary.editor;
  return primary.editor ?? secondary.editor;
}

/**
 * Pure merge for tests: chooses semanticValues from task vs local cache using timestamps and counts.
 */
export function mergeProblemPayloadsForHydration(
  fromTask: ProblemPayload,
  fromLs: ProblemPayload | null,
  taskUpdatedAtMs: number,
): ProblemPayload {
  const ta = fromTask.semanticValues?.length ?? 0;
  const la = fromLs?.semanticValues?.length ?? 0;
  const lsTime = fromLs?.persistedAt ?? 0;

  if (ta === 0 && la === 0) {
    return normalizeProblemPayload({
      version: 1,
      editor: mergeEditorPrefer(fromTask, fromLs ?? fromTask),
    });
  }
  if (la === 0) {
    return normalizeProblemPayload({ ...fromTask, version: 1 });
  }
  if (ta === 0) {
    return normalizeProblemPayload({ ...fromLs!, version: 1 });
  }

  const preferLocal = lsTime > taskUpdatedAtMs || (lsTime === 0 && taskUpdatedAtMs === 0 && la >= ta);

  if (preferLocal && fromLs) {
    return normalizeProblemPayload({
      version: 1,
      semanticValues: fromLs.semanticValues,
      editor: mergeEditorPrefer(fromLs, fromTask),
      persistedAt: fromLs.persistedAt,
    });
  }
  return normalizeProblemPayload({
    version: 1,
    semanticValues: fromTask.semanticValues,
    editor: mergeEditorPrefer(fromTask, fromLs ?? fromTask),
  });
}

export function loadMergedProblemPayload(instanceId: string, projectId: string): ProblemPayload {
  const fromTask = buildPayloadFromTaskRepository(instanceId);
  const fromLs = readPayloadFromLocalStorage(projectId, instanceId);
  const taskMs = getTaskUpdatedAtMs(instanceId);
  return mergeProblemPayloadsForHydration(fromTask, fromLs, taskMs);
}

/**
 * Writes localStorage (with persistedAt), TaskRepository.semanticValues, optional task template problem mirror.
 */
export function persistProblemClassificationPayload(
  instanceId: string,
  projectId: string,
  payload: ProblemPayload,
  options?: { templateTaskId?: string },
): void {
  const normalized = normalizeProblemPayload(payload);
  const now = Date.now();
  const forStorage: ProblemPayload = { ...normalized, version: 1, persistedAt: now };

  try {
    if (typeof window !== 'undefined') {
      const key = getProblemClassificationStorageKey(projectId, instanceId);
      localStorage.setItem(key, JSON.stringify(forStorage));
    }
  } catch (e) {
    console.warn('[ProblemClassificationPersistence] localStorage write failed', e);
  }

  const semanticValues = forStorage.semanticValues ?? [];
  const ok = taskRepository.updateTask(instanceId, { semanticValues }, projectId || undefined);
  if (!ok) {
    console.warn('[ProblemClassificationPersistence] taskRepository.updateTask skipped — task not in repository', {
      instanceId,
    });
  }

  if (options?.templateTaskId) {
    try {
      ProjectDataService.setTaskTemplateProblemById(options.templateTaskId, forStorage);
    } catch {
      /* best-effort */
    }
  }
}
