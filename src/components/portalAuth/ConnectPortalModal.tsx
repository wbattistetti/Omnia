/**
 * Modal «Connetti al portale» — avvia OAuth Google Workspace (popup + PKCE lato server).
 */

import React from 'react';
import { Loader2, Shield } from 'lucide-react';
import { normalizePortalOrigin } from '@domain/portalAuth/normalizePortalOrigin';
import type { PortalConnectionMeta } from '@domain/portalAuth/portalConnectionTypes';
import { openPortalOAuthPopup, startPortalOAuth } from '@services/portalAuthApi';

export interface ConnectPortalModalProps {
  open: boolean;
  origin: string;
  projectId: string;
  portalHostLabel?: string;
  onClose: () => void;
  onConnected: (meta: PortalConnectionMeta) => void;
}

export function ConnectPortalModal({
  open,
  origin,
  projectId,
  portalHostLabel,
  onClose,
  onConnected,
}: ConnectPortalModalProps): React.ReactElement | null {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const hostDisplay = React.useMemo(() => {
    try {
      return portalHostLabel ?? new URL(normalizePortalOrigin(origin)).host;
    } catch {
      return origin;
    }
  }, [origin, portalHostLabel]);

  React.useEffect(() => {
    if (!open) {
      setError(null);
      setBusy(false);
    }
  }, [open]);

  const handleConnect = React.useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const originNorm = normalizePortalOrigin(origin);
      const { authUrl, connectionId } = await startPortalOAuth({
        projectId,
        origin: originNorm,
      });
      const result = await openPortalOAuthPopup(authUrl);
      if (!result.success || !result.connectionId) {
        throw new Error(result.message || 'Connessione annullata o non riuscita.');
      }
      const meta: PortalConnectionMeta = {
        id: result.connectionId || connectionId,
        origin: result.origin ?? originNorm,
        provider: 'google_workspace',
        status: 'connected',
        connectedAt: new Date().toISOString(),
        label: hostDisplay,
      };
      onConnected(meta);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [origin, projectId, hostDisplay, onConnected, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="connect-portal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="border-b border-slate-800 px-5 py-4">
          <div className="flex items-center gap-2 text-violet-200">
            <Shield className="h-5 w-5 shrink-0" aria-hidden />
            <h2 id="connect-portal-title" className="text-base font-semibold text-slate-100">
              Connetti al portale
            </h2>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            Le specifiche OpenAPI su{' '}
            <span className="font-mono text-slate-200">{hostDisplay}</span> sono protette da accesso.
            Accedi con il tuo account Google Workspace per consentire a Omnia di recuperare lo
            swagger in sicurezza.
          </p>
        </div>
        <div className="space-y-3 px-5 py-4">
          {error ? (
            <p className="rounded border border-red-800/80 bg-red-950/40 px-3 py-2 text-xs text-red-200">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleConnect()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-violet-600/80 bg-violet-950/50 px-4 py-2.5 text-sm font-semibold text-violet-50 hover:bg-violet-900/60 disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <span className="text-lg leading-none" aria-hidden>
                G
              </span>
            )}
            {busy ? 'Connessione in corso…' : 'Accedi con Google Workspace'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="w-full rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
          >
            Annulla
          </button>
        </div>
      </div>
    </div>
  );
}