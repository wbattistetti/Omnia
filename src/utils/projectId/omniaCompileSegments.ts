/**
 * Segmenti autoritativi per generateProjectId in compile: metadata progetto + versione release.
 */

import type { GenerateProjectIdSegments } from './generateProjectId';

/** Estrae cliente / nome / versione da projectData e ambiente. */
export function readOmniaCompileProjectSegments(projectData: unknown): GenerateProjectIdSegments {
  const pd = projectData as Record<string, unknown> | null | undefined;
  const meta = (pd?.meta || pd?.projectMeta || pd) as Record<string, unknown> | undefined;
  const name =
    (typeof pd?.name === 'string' && pd.name.trim()) ||
    (typeof meta?.name === 'string' && meta.name.trim()) ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('currentProjectName')?.trim() : '') ||
    'project';
  const client =
    (typeof meta?.clientSlug === 'string' && meta.clientSlug.trim()) ||
    (typeof meta?.client === 'string' && meta.client.trim()) ||
    (typeof pd?.clientSlug === 'string' && pd.clientSlug.trim()) ||
    (typeof pd?.clientName === 'string' && pd.clientName.trim()) ||
    'default';
  const version =
    (typeof pd?.version === 'string' && pd.version.trim()) ||
    (typeof import.meta !== 'undefined' &&
      typeof import.meta.env?.VITE_OMNIA_RELEASE === 'string' &&
      import.meta.env.VITE_OMNIA_RELEASE.trim()) ||
    (typeof import.meta !== 'undefined' &&
      typeof import.meta.env?.VITE_APP_VERSION === 'string' &&
      import.meta.env.VITE_APP_VERSION.trim()) ||
    '0';
  return { cliente: client, nomeProgetto: name, versione: version };
}
