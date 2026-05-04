/**
 * Più tunnel HTTP ngrok simultanei (una porta locale → un listener).
 * Usa `@ngrok/ngrok`; authtoken da body o NGROK_AUTHTOKEN.
 */

let cachedNgrok = undefined;

function getNgrokModule() {
  if (cachedNgrok !== undefined) return cachedNgrok;
  try {
    // eslint-disable-next-line import/no-extraneous-dependencies, global-require
    cachedNgrok = require('@ngrok/ngrok');
  } catch {
    cachedNgrok = null;
  }
  return cachedNgrok;
}

/** @type {Map<number, import('@ngrok/ngrok').Listener>} */
const listenersByPort = new Map();
let lastStartError = null;

function parsePort(x) {
  const n = typeof x === 'number' ? x : parseInt(String(x ?? ''), 10);
  if (!Number.isFinite(n) || n < 1 || n > 65535) return null;
  return n;
}

/**
 * @param {{ port: number, authtoken?: string | null }} opts
 */
async function startTunnelOnPort(opts) {
  const ngrok = getNgrokModule();
  if (!ngrok) {
    const err = new Error('Pacchetto @ngrok/ngrok non installato. Esegui: npm install');
    Object.assign(err, { code: 'NGROK_SDK_MISSING' });
    throw err;
  }

  const port = parsePort(opts.port);
  if (port == null) {
    const err = new Error('Porta locale non valida (1–65535).');
    Object.assign(err, { code: 'INVALID_PORT' });
    throw err;
  }

  const fromBody = typeof opts.authtoken === 'string' ? opts.authtoken.trim() : '';
  const fromEnv = typeof process.env.NGROK_AUTHTOKEN === 'string' ? process.env.NGROK_AUTHTOKEN.trim() : '';
  const authtoken = fromBody || fromEnv;
  if (!authtoken) {
    const err = new Error('Authtoken ngrok mancante: pannello o NGROK_AUTHTOKEN in backend/.env');
    Object.assign(err, { code: 'NGROK_NO_AUTHTOKEN' });
    throw err;
  }

  const existing = listenersByPort.get(port);
  if (existing) {
    try {
      await existing.close();
    } catch {
      /* ignore */
    }
    listenersByPort.delete(port);
  }

  lastStartError = null;
  try {
    const listener = await ngrok.forward({ addr: port, authtoken });
    listenersByPort.set(port, listener);
    const publicUrl = listener.url && typeof listener.url === 'function' ? listener.url() : null;
    return { publicUrl: publicUrl || null, localPort: port };
  } catch (e) {
    lastStartError = e instanceof Error ? e.message : String(e);
    listenersByPort.delete(port);
    throw e;
  }
}

/**
 * @param {{ ports: number[], authtoken?: string | null }} opts
 * @returns {Promise<{ tunnels: Record<string, { publicUrl: string | null, localPort: number }>, errors?: Array<{ port: number, message: string }> }>}
 */
async function startTunnelsForPorts(opts) {
  const rawPorts = Array.isArray(opts.ports) ? opts.ports : [];
  const seen = new Set();
  const ports = [];
  for (const p of rawPorts) {
    const n = parsePort(p);
    if (n != null && !seen.has(n)) {
      seen.add(n);
      ports.push(n);
    }
  }
  if (!ports.length) {
    const err = new Error('Elenco porte vuoto o non valido.');
    Object.assign(err, { code: 'INVALID_PORTS' });
    throw err;
  }

  /** @type {Record<string, { publicUrl: string | null, localPort: number }>} */
  const tunnels = {};
  /** @type {Array<{ port: number, message: string }>} */
  const errors = [];

  for (const port of ports) {
    try {
      const out = await startTunnelOnPort({ port, authtoken: opts.authtoken });
      tunnels[String(port)] = { publicUrl: out.publicUrl, localPort: out.localPort };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push({ port, message: msg });
    }
  }

  if (Object.keys(tunnels).length === 0 && errors.length > 0) {
    const err = new Error(errors.map((x) => `${x.port}: ${x.message}`).join('; '));
    Object.assign(err, { code: 'NGROK_PARTIAL_FAIL', details: errors });
    throw err;
  }

  return errors.length ? { tunnels, errors } : { tunnels };
}

async function stopAllTunnels() {
  const entries = [...listenersByPort.entries()];
  listenersByPort.clear();
  for (const [, listener] of entries) {
    try {
      await listener.close();
    } catch {
      /* ignore */
    }
  }
}

/**
 * @returns {{ sdkAvailable: boolean, tunnels: Record<string, { running: boolean, publicUrl: string | null }>, lastStartError: string | null }}
 */
function getDevTunnelStatus() {
  const ngrok = getNgrokModule();
  const sdkAvailable = ngrok !== null;
  /** @type {Record<string, { running: boolean, publicUrl: string | null }>} */
  const tunnels = {};

  for (const [port, listener] of listenersByPort.entries()) {
    let publicUrl = null;
    try {
      publicUrl = listener.url && typeof listener.url === 'function' ? listener.url() : null;
    } catch {
      publicUrl = null;
    }
    tunnels[String(port)] = { running: true, publicUrl };
  }

  return {
    sdkAvailable,
    tunnels,
    lastStartError,
    running: listenersByPort.size > 0,
  };
}

module.exports = {
  startTunnelOnPort,
  startTunnelsForPorts,
  stopAllTunnels,
  getDevTunnelStatus,
  parsePort,
  getNgrokModule,
};
