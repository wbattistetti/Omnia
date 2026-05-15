/**
 * Portal OAuth connections — metadata in project JSON (tokens only on server).
 */

export type PortalAuthProvider = 'google_workspace' | 'generic_oidc';

export type PortalConnectionStatus = 'connected' | 'expired' | 'revoked' | 'pending';

/** Public row stored in `project.portalConnections.connections`. */
export interface PortalConnectionMeta {
  id: string;
  origin: string;
  provider: PortalAuthProvider;
  status: PortalConnectionStatus;
  label?: string;
  /** ISO timestamp when last connected successfully. */
  connectedAt?: string | null;
}

export interface ProjectPortalConnectionsBlob {
  schemaVersion: 1;
  connections: PortalConnectionMeta[];
}

export const PORTAL_AUTH_REQUIRED_CODE = 'PORTAL_AUTH_REQUIRED' as const;
export const PORTAL_AUTH_EXPIRED_CODE = 'PORTAL_AUTH_EXPIRED' as const;
