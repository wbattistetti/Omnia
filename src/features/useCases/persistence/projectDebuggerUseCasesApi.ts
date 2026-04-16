import type { UseCase } from '../model';

/**
 * Loads debugger regression use cases from project DB (project_meta.debuggerRegressionUseCases).
 */
export async function loadDebuggerUseCasesFromProject(projectId: string): Promise<UseCase[]> {
  const pid = String(projectId || '').trim();
  if (!pid) return [];
  const res = await fetch(`/api/projects/${encodeURIComponent(pid)}/debugger-use-cases`);
  if (!res.ok) return [];
  const data = (await res.json()) as { useCases?: unknown };
  return normalizeUseCasesPayload(data.useCases);
}

/**
 * Persists debugger regression use cases (called when the user saves the project).
 */
export async function saveDebuggerUseCasesToProject(
  projectId: string,
  useCases: readonly UseCase[]
): Promise<void> {
  const pid = String(projectId || '').trim();
  if (!pid) {
    throw new Error('saveDebuggerUseCasesToProject: projectId is required.');
  }
  const res = await fetch(`/api/projects/${encodeURIComponent(pid)}/debugger-use-cases`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ useCases: [...useCases] }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`saveDebuggerUseCasesToProject failed: ${res.status} ${text}`);
  }
}

function normalizeUseCasesPayload(raw: unknown): UseCase[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
    .map((x) => ({
      id: String(x.id || '').trim(),
      key: String(x.key || '').trim(),
      label: String(x.label || '').trim(),
      note: typeof x.note === 'string' && x.note.trim().length > 0 ? x.note : undefined,
      steps: Array.isArray(x.steps) ? x.steps : [],
    }))
    .filter((x) => x.id && x.key && x.label);
}
