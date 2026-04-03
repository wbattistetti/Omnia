/**
 * Client API: create a new catalog entry and project DB by copying persisted data from a source project.
 * Call after a full project save so the database matches in-memory canvas state.
 */

export type CreateProjectVersionPayload = {
  sourceProjectId: string;
  projectName: string;
  version: string;
  versionQualifier: string;
  clientName?: string | null;
  ownerCompany?: string | null;
  ownerClient?: string | null;
};

export async function createProjectVersion(
  payload: CreateProjectVersionPayload
): Promise<string> {
  const res = await fetch('/api/projects/create-version', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sourceProjectId: payload.sourceProjectId,
      projectName: payload.projectName,
      version: payload.version,
      versionQualifier: payload.versionQualifier || 'production',
      clientName: payload.clientName ?? null,
      ownerCompany: payload.ownerCompany ?? null,
      ownerClient: payload.ownerClient ?? null,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || err.message || `Create version failed: ${res.status}`);
  }
  const body = await res.json();
  const projectId = body?.projectId;
  if (!projectId || typeof projectId !== 'string') {
    throw new Error('Create version response missing projectId');
  }
  return projectId;
}
