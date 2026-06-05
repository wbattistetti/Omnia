/**
 * Sincronizza stato ngrok Express → mappa porta→URL pubblico in localStorage (compilazione / ConvAI).
 */

import { saveDevTunnelPortMapToStorage } from './devTunnelCompileBridge';
import type { NgrokMultiStatus } from '@services/devTunnelNgrokApi';

const LS_TOKEN = 'omnia.devTunnel.ngrokAuthtoken';

/** Token ngrok salvato in browser (Impostazioni → Tunnel dev). */
export function loadNgrokAuthtokenFromStorage(): string {
  try {
    return localStorage.getItem(LS_TOKEN) ?? '';
  } catch {
    return '';
  }
}

/** Costruisce mappa porta→base URL da risposta `/api/dev-tunnel/ngrok/status`. */
export function mergeNgrokStatusIntoPortMap(
  tunnels: NgrokMultiStatus['tunnels']
): Record<number, string> {
  const map: Record<number, string> = {};
  if (!tunnels) return map;
  for (const [k, v] of Object.entries(tunnels)) {
    const port = parseInt(k, 10);
    const u = v?.publicUrl;
    if (Number.isFinite(port) && typeof u === 'string' && u.trim()) {
      map[port] = u.trim().replace(/\/$/, '');
    }
  }
  return map;
}

/** Persiste mappa se non vuota (merge con valori già noti). */
export function persistNgrokPortMapFromStatus(
  tunnels: NgrokMultiStatus['tunnels']
): Record<number, string> {
  const merged = mergeNgrokStatusIntoPortMap(tunnels);
  if (Object.keys(merged).length > 0) {
    saveDevTunnelPortMapToStorage(merged);
  }
  return merged;
}

/** True se ogni porta richiesta ha tunnel ngrok in esecuzione con URL pubblico. */
export function ngrokTunnelsReadyForPorts(
  ports: readonly number[],
  tunnels: NgrokMultiStatus['tunnels']
): boolean {
  for (const port of ports) {
    const t = tunnels?.[String(port)];
    if (!t?.running || !String(t.publicUrl ?? '').trim()) return false;
  }
  return ports.length > 0;
}
