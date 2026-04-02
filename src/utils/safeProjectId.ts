/**
 * Centralized project id resolution for in-memory services (variables, etc.).
 * When no project is open in runtime, authoring still uses a stable fallback bucket.
 */

import { getCurrentProjectId } from '../state/runtime';

export const DEFAULT_PROJECT_BUCKET = '__default_project__';

let fallbackWarned = false;

/**
 * Returns the active project id from runtime, or {@link DEFAULT_PROJECT_BUCKET} when none is set.
 * Logs once when the fallback bucket is used (dev visibility).
 */
export function getSafeProjectId(): string {
  const raw = getCurrentProjectId();
  const t = raw != null ? String(raw).trim() : '';
  if (t) {
    fallbackWarned = false;
    return t;
  }
  if (!fallbackWarned) {
    fallbackWarned = true;
    console.warn(
      '[Omnia][safeProjectId] No active projectId in runtime — using in-memory bucket',
      { bucket: DEFAULT_PROJECT_BUCKET }
    );
  }
  return DEFAULT_PROJECT_BUCKET;
}

/** True when the id is the fallback bucket (not a persisted server project). */
export function isFallbackProjectBucket(projectId: string | null | undefined): boolean {
  return String(projectId ?? '').trim() === DEFAULT_PROJECT_BUCKET;
}

/**
 * Prefer an explicit project id when provided; otherwise {@link getSafeProjectId}.
 * Use for VariableCreationService and any code that receives `projectId?: string | null`.
 */
export function resolveVariableStoreProjectId(explicit?: string | null): string {
  const t = explicit != null ? String(explicit).trim() : '';
  return t || getSafeProjectId();
}
