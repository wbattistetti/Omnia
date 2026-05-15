/**
 * Merge portal connection metadata into project blob (no secrets).
 */

import type { ProjectData } from '@types/project';
import type { PortalConnectionMeta, ProjectPortalConnectionsBlob } from './portalConnectionTypes';

export function getProjectPortalConnections(
  data: ProjectData | null | undefined
): PortalConnectionMeta[] {
  return data?.portalConnections?.connections ?? [];
}

export function upsertProjectPortalConnection(
  data: ProjectData,
  meta: PortalConnectionMeta
): ProjectPortalConnectionsBlob {
  const prev: ProjectPortalConnectionsBlob = data.portalConnections ?? {
    schemaVersion: 1,
    connections: [],
  };
  const rest = prev.connections.filter((c) => c.id !== meta.id && c.origin !== meta.origin);
  return {
    schemaVersion: 1,
    connections: [...rest, meta],
  };
}

export function findConnectedPortalForOrigin(
  data: ProjectData | null | undefined,
  origin: string
): PortalConnectionMeta | undefined {
  const list = getProjectPortalConnections(data);
  return list.find((c) => c.origin === origin && c.status === 'connected');
}
