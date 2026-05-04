/**
 * Estrae porte TCP usate in URL verso servizi locali (task + config IA) per suggerire tunnel ngrok.
 */

import { collectLocalhostPortsFromDeepValue } from './devTunnelCompileBridge';

/**
 * Unione delle porte localhost/127.0.0.1/[::1] citate nei task e nella config IA (ordinata, senza duplicati).
 */
export function collectProjectLocalhostPortsForTunnel(params: {
  tasks: unknown[];
  iaConfig?: unknown;
}): number[] {
  const s = new Set<number>();
  if (params.iaConfig != null) {
    for (const p of collectLocalhostPortsFromDeepValue(params.iaConfig)) {
      s.add(p);
    }
  }
  for (const t of params.tasks) {
    for (const p of collectLocalhostPortsFromDeepValue(t)) {
      s.add(p);
    }
  }
  return [...s].sort((a, b) => a - b);
}
