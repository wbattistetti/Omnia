/**
 * Mappa porta locale → base URL pubblico ngrok per compilazione/orchestrator.
 * Persistenza in localStorage (sessione browser); sincronizzata dal pannello tunnel dopo Avvia/Aggiorna.
 */

import type { CompilationError } from '@components/FlowCompiler/types';

const LS_MAP = 'omnia.devTunnel.portToPublicBaseJson';
const LS_COMPILE = 'omnia.devTunnel.compileUseTunnel';

/** Stesso valore usato in `getCompileUseDevTunnel` / pannello tunnel. */
export const DEV_TUNNEL_COMPILE_FLAG_KEY = LS_COMPILE;

/** Porte suggerite nel pannello (combo). */
export const DEV_TUNNEL_PRESET_PORTS: readonly number[] = [3100, 3110, 8000, 5000];

export function loadDevTunnelPortMapFromStorage(): Record<number, string> {
  try {
    const raw = localStorage.getItem(LS_MAP);
    if (!raw?.trim()) return {};
    const o = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<number, string> = {};
    for (const [k, v] of Object.entries(o)) {
      const p = parseInt(k, 10);
      if (!Number.isFinite(p)) continue;
      if (typeof v === 'string' && v.trim()) out[p] = v.trim().replace(/\/$/, '');
    }
    return out;
  } catch {
    return {};
  }
}

export function saveDevTunnelPortMapToStorage(map: Record<number, string>): void {
  try {
    const norm: Record<string, string> = {};
    for (const [k, v] of Object.entries(map)) {
      const p = parseInt(String(k), 10);
      if (!Number.isFinite(p) || !String(v).trim()) continue;
      norm[String(p)] = String(v).trim().replace(/\/$/, '');
    }
    localStorage.setItem(LS_MAP, JSON.stringify(norm));
  } catch {
    /* ignore */
  }
}

/** True solo se l’utente ha attivato esplicitamente «Compilazione con tunnel» (`localStorage` = `1`). */
export function getCompileUseDevTunnel(): boolean {
  try {
    return localStorage.getItem(LS_COMPILE) === '1';
  } catch {
    return false;
  }
}

export function setCompileUseDevTunnel(enabled: boolean): void {
  try {
    localStorage.setItem(LS_COMPILE, enabled ? '1' : '0');
  } catch {
    /* ignore */
  }
}

function extractLocalhostPortsFromValue(v: unknown, into: Set<number>): void {
  if (typeof v === 'string') {
    const re = /https?:\/\/(?:127\.0\.0\.1|localhost|\[::1\]):(\d+)/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(v)) !== null) {
      const p = parseInt(m[1], 10);
      if (Number.isFinite(p)) into.add(p);
    }
  } else if (Array.isArray(v)) {
    for (const x of v) extractLocalhostPortsFromValue(x, into);
  } else if (v && typeof v === 'object') {
    for (const x of Object.values(v as Record<string, unknown>)) {
      extractLocalhostPortsFromValue(x, into);
    }
  }
}

const LOCALHOST_WITH_PORT_RE = /https?:\/\/(?:127\.0\.0\.1|localhost|\[::1\]):(\d+)/gi;

/** Host locale senza `:porta` — non mappabile su ngrok per porta. */
const LOCALHOST_NO_EXPLICIT_PORT_RE =
  /^https?:\/\/(?:127\.0\.0\.1|localhost|\[::1\])(?=\/|\?|#|$)/i;

/** Porte localhost citate in una stringa URL. */
export function collectLocalhostPortsFromString(s: string): number[] {
  const out: number[] = [];
  let m: RegExpExecArray | null;
  LOCALHOST_WITH_PORT_RE.lastIndex = 0;
  while ((m = LOCALHOST_WITH_PORT_RE.exec(s)) !== null) {
    const p = parseInt(m[1], 10);
    if (Number.isFinite(p)) out.push(p);
  }
  return out;
}

export type LocalhostEndpointReachability = {
  unreachable: boolean;
  message?: string;
  missingPorts?: number[];
};

/**
 * True se l’endpoint è ancora localhost senza tunnel pubblico mappato (ConvAI / agenti cloud).
 */
export function analyzeLocalhostEndpointReachability(endpoint: string): LocalhostEndpointReachability {
  const trimmed = endpoint.trim();
  if (!trimmed) return { unreachable: false };

  if (LOCALHOST_NO_EXPLICIT_PORT_RE.test(trimmed)) {
    return {
      unreachable: true,
      message:
        'Webhook non raggiungibile: URL verso host locale senza porta esplicita (usa http://localhost:PORTA/…). Un agente esterno richiede porta esplicita e tunnel verso quella porta.',
    };
  }

  const ports = collectLocalhostPortsFromString(trimmed);
  if (ports.length === 0) return { unreachable: false };
  const map = loadDevTunnelPortMapFromStorage();
  const missing = [...new Set(ports)].filter((p) => !String(map[p] ?? '').trim());
  if (missing.length === 0) return { unreachable: false };
  return {
    unreachable: true,
    missingPorts: missing,
    message: `Webhook non raggiungibile: porta/e locale/i ${missing.join(', ')} senza tunnel attivo (Impostazioni → Tunnel dev / ngrok → Avvia tunnel per la porta ${missing.join(' e ')}).`,
  };
}

/**
 * Raccoglie porte TCP da URL che puntano a localhost / 127.0.0.1 / [::1] in qualsiasi stringa o oggetto annidato.
 */
export function collectLocalhostPortsFromDeepValue(root: unknown): number[] {
  const into = new Set<number>();
  extractLocalhostPortsFromValue(root, into);
  return [...into].sort((a, b) => a - b);
}

/**
 * Errori di compilazione se «Compilazione con tunnel» è attiva e manca il tunnel per una porta citata negli URL localhost.
 */
export function collectDevTunnelCompileErrors(mergedTasks: unknown[]): Array<Record<string, unknown>> {
  if (!getCompileUseDevTunnel()) return [];
  const portMap = loadDevTunnelPortMapFromStorage();
  const out: Array<Record<string, unknown>> = [];

  for (const raw of mergedTasks) {
    if (!raw || typeof raw !== 'object') continue;
    const t = raw as { id?: string };
    if (!t.id) continue;
    const ports = new Set<number>();
    extractLocalhostPortsFromValue(raw, ports);
    const missing: number[] = [];
    for (const p of ports) {
      if (!portMap[p]) missing.push(p);
    }
    if (!missing.length) continue;

    const err: CompilationError = {
      taskId: t.id,
      message: `Compilazione con tunnel: nessun URL pubblico per la/e porta/e locale/i ${missing.join(', ')} (Impostazioni → Tunnel → Avvia tunnel). Oppure disattiva «Compilazione con tunnel».`,
      severity: 'Error',
      category: 'DevTunnel',
      code: 'DevTunnelLocalhostPortNotExposed',
      fixTarget: { type: 'task', taskId: t.id },
    };
    out.push({ ...err } as Record<string, unknown>);
  }

  return out;
}

/**
 * Sostituisce in profondità gli URL `localhost`/`127.0.0.1` con le basi tunnel note.
 */
export function rewriteCompilePayloadWithDevTunnel<T>(value: T): T {
  const portMap = loadDevTunnelPortMapFromStorage();
  if (!Object.keys(portMap).length) return value;

  function repl(s: string): string {
    let out = s;
    for (const [portStr, base] of Object.entries(portMap)) {
      const p = parseInt(portStr, 10);
      if (!Number.isFinite(p) || !String(base).trim()) continue;
      const b = String(base).trim().replace(/\/$/, '');
      out = out.split(`http://127.0.0.1:${p}`).join(b);
      out = out.split(`http://localhost:${p}`).join(b);
      out = out.split(`http://[::1]:${p}`).join(b);
      out = out.split(`https://127.0.0.1:${p}`).join(b);
      out = out.split(`https://localhost:${p}`).join(b);
      out = out.split(`https://[::1]:${p}`).join(b);
    }
    return out;
  }

  function walk(v: unknown): unknown {
    if (typeof v === 'string') return repl(v);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      const n: Record<string, unknown> = {};
      for (const k of Object.keys(o)) n[k] = walk(o[k]);
      return n;
    }
    return v;
  }

  return walk(value) as T;
}

export function devTunnelMapHasAnyBase(): boolean {
  const m = loadDevTunnelPortMapFromStorage();
  return Object.keys(m).some((k) => !!m[parseInt(k, 10)]?.trim());
}
