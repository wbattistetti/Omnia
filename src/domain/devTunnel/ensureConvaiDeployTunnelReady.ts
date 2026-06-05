/**
 * Avvia ngrok e allinea la mappa tunnel quando il Deploy ConvAI usa gateway Omnia (logging webhook).
 */

import {
  fetchNgrokTunnelStatus,
  startNgrokTunnels,
  type NgrokMultiStartResult,
} from '@services/devTunnelNgrokApi';
import { loadDevTunnelPortMapFromStorage, saveDevTunnelPortMapToStorage } from './devTunnelCompileBridge';
import {
  loadNgrokAuthtokenFromStorage,
  mergeNgrokStatusIntoPortMap,
  ngrokTunnelsReadyForPorts,
} from './ngrokTunnelMapSync';

/** Porta Express del gateway runtime ConvAI in dev. */
export const CONVAI_WEBHOOK_GATEWAY_PORT = 3100;

export type EnsureConvaiDeployTunnelReadyResult =
  | {
      ok: true;
      /** URL pubblici per porta (dopo sync). */
      publicUrlsByPort: Record<number, string>;
      /** True se è stato invocato POST ngrok/start in questa chiamata. */
      started: boolean;
    }
  | { ok: false; error: string };

function mergeStartResultIntoMap(
  base: Record<number, string>,
  start: NgrokMultiStartResult
): Record<number, string> {
  const out = { ...base };
  if (!start.tunnels) return out;
  for (const [k, v] of Object.entries(start.tunnels)) {
    const port = parseInt(k, 10);
    const u = v?.publicUrl;
    if (Number.isFinite(port) && typeof u === 'string' && u.trim()) {
      out[port] = u.trim().replace(/\/$/, '');
    }
  }
  return out;
}

function portsMissingPublicUrl(
  ports: readonly number[],
  map: Record<number, string>
): number[] {
  return ports.filter((p) => !String(map[p] ?? '').trim());
}

/**
 * Garantisce tunnel ngrok per le porte richieste (default gateway ConvAI :3100).
 * Aggiorna `localStorage` con URL pubblici allineati allo stato Express/ngrok.
 */
export async function ensureConvaiDeployTunnelReady(
  ports: readonly number[] = [CONVAI_WEBHOOK_GATEWAY_PORT]
): Promise<EnsureConvaiDeployTunnelReadyResult> {
  const uniquePorts = [
    ...new Set(
      ports
        .map((p) => Math.floor(Number(p)))
        .filter((p) => Number.isFinite(p) && p >= 1 && p <= 65535)
    ),
  ];
  if (uniquePorts.length === 0) {
    return { ok: true, publicUrlsByPort: {}, started: false };
  }

  let status = await fetchNgrokTunnelStatus();
  if (!status.ok) {
    return {
      ok: false,
      error:
        status.error ??
        'Express non raggiungibile. Avvia il backend dev (`npm run be:express`) sulla porta 3100.',
    };
  }

  let map = mergeNgrokStatusIntoPortMap(status.tunnels);
  const existingMap = loadDevTunnelPortMapFromStorage();
  map = { ...existingMap, ...map };

  let started = false;
  const needsStart =
    !ngrokTunnelsReadyForPorts(uniquePorts, status.tunnels) ||
    portsMissingPublicUrl(uniquePorts, map).length > 0;

  if (needsStart) {
    const authtoken = loadNgrokAuthtokenFromStorage().trim();
    if (!authtoken) {
      return {
        ok: false,
        error:
          'Token ngrok mancante: apri Impostazioni → Tunnel dev, incolla NGROK_AUTHTOKEN e riprova il Deploy.',
      };
    }

    const start = await startNgrokTunnels({ ports: uniquePorts, authtoken });
    if (!start.ok) {
      return {
        ok: false,
        error: start.error ?? 'Avvio tunnel ngrok fallito.',
      };
    }
    started = true;
    map = mergeStartResultIntoMap(map, start);

    if (start.errors?.length) {
      const failed = start.errors.map((e) => `${e.port}: ${e.message}`).join('; ');
      const stillMissing = portsMissingPublicUrl(uniquePorts, map);
      if (stillMissing.length > 0) {
        return {
          ok: false,
          error: `Tunnel ngrok parziale (${failed}). Porte senza URL: ${stillMissing.join(', ')}.`,
        };
      }
    }

    status = await fetchNgrokTunnelStatus();
    if (status.ok) {
      map = { ...map, ...mergeNgrokStatusIntoPortMap(status.tunnels) };
    }
  }

  const finalMissing = portsMissingPublicUrl(uniquePorts, map);
  if (finalMissing.length > 0) {
    return {
      ok: false,
      error: `Tunnel non disponibile per porta/e ${finalMissing.join(', ')}. Verifica ngrok in Impostazioni → Tunnel dev.`,
    };
  }

  saveDevTunnelPortMapToStorage(map);

  const publicUrlsByPort: Record<number, string> = {};
  for (const p of uniquePorts) {
    publicUrlsByPort[p] = map[p]!;
  }

  return { ok: true, publicUrlsByPort, started };
}
