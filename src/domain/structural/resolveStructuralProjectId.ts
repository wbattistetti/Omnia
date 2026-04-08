/**
 * Resolves project id for StructuralOrchestrator: explicit id, then ProjectData fields, then runtime current project.
 */

import { getCurrentProjectId } from '../../state/runtime';

export function resolveStructuralProjectId(explicit: string | undefined, projectData?: unknown): string {
  const e = String(explicit || '').trim();
  if (e) return e;
  const pd = projectData as { id?: string; projectId?: string } | null | undefined;
  const fromPd = String(pd?.id ?? pd?.projectId ?? '').trim();
  if (fromPd) return fromPd;
  return String(getCurrentProjectId() || '').trim();
}
