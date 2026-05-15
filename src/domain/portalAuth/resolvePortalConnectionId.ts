/**
 * Resolve PortalConnection id for a backend URL from catalog entry + project metadata.
 */

import type { ManualCatalogEntry } from '@domain/backendCatalog/catalogTypes';
import type { ProjectData } from '@types/project';
import { resolvePortalConnection } from '@services/portalAuthApi';
import { normalizePortalOrigin } from './normalizePortalOrigin';
import { findConnectedPortalForOrigin } from './projectPortalConnections';
import type { PortalConnectionMeta } from './portalConnectionTypes';

export function resolvePortalConnectionIdForUrl(
  data: ProjectData | null | undefined,
  endpointUrl: string,
  entry?: Pick<ManualCatalogEntry, 'portalConnectionId'>
): string | undefined {
  const fromEntry = (entry?.portalConnectionId || '').trim();
  if (fromEntry) return fromEntry;
  try {
    const origin = normalizePortalOrigin(endpointUrl);
    const hit = findConnectedPortalForOrigin(data, origin);
    return hit?.id;
  } catch {
    return undefined;
  }
}

/**
 * Fonte di verità: FastAPI (token su disco). I metadati nel progetto non bastano da soli.
 */
export async function resolvePortalConnectionForUrl(
  _data: ProjectData | null | undefined,
  projectId: string | undefined,
  endpointUrl: string,
  _entry?: Pick<ManualCatalogEntry, 'portalConnectionId'>
): Promise<PortalConnectionMeta | null> {
  if (!projectId?.trim()) return null;
  try {
    const origin = normalizePortalOrigin(endpointUrl);
    return await resolvePortalConnection(projectId.trim(), origin);
  } catch {
    return null;
  }
}
