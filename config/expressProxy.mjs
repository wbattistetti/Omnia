/**
 * Vite dev proxy verso Express (:3100) con risposta JSON chiara se il backend è spento.
 */

/** 127.0.0.1 evita fallimenti intermittenti su Windows quando `localhost` risolve su IPv6. */
const EXPRESS_TARGET = 'http://127.0.0.1:3100';

const BACKEND_UNAVAILABLE_JSON = JSON.stringify({
  success: false,
  error: 'backend_unavailable',
  message:
    'Backend Express non raggiungibile su 127.0.0.1:3100. Avvia npm run dev:beNew o npm run dev:allNew (Vite + Express + FastAPI).',
});

/**
 * @param {{ onProxyReq?: (proxyReq: import('http').ClientRequest, req: import('http').IncomingMessage, res: import('http').ServerResponse, options: object) => void }} [opts]
 */
export function expressProxyConfig(opts = {}) {
  const { onProxyReq } = opts;
  return {
    target: EXPRESS_TARGET,
    changeOrigin: true,
    configure: (proxy) => {
      proxy.on('error', (err, _req, res) => {
        const code = err && typeof err === 'object' && 'code' in err ? String(err.code) : '';
        console.warn('[vite proxy express]', code || err?.message || err);
        if (res && typeof res.writeHead === 'function' && !res.headersSent) {
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(BACKEND_UNAVAILABLE_JSON);
        }
      });
      if (typeof onProxyReq === 'function') {
        proxy.on('proxyReq', onProxyReq);
      }
    },
  };
}
