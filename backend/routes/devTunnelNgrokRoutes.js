/**
 * API Express per tunnel di sviluppo ngrok (più porte locali → più URL pubblici).
 */

const {
  startTunnelsForPorts,
  stopAllTunnels,
  getDevTunnelStatus,
  parsePort,
} = require('../services/devTunnelNgrokService');

function logDevTunnel(req, detail) {
  const path = req.originalUrl || req.url || '';
  const hit = `[devTunnel] ${req.method} ${path}`;
  if (detail !== undefined) {
    console.log(hit, detail);
  } else {
    console.log(hit);
  }
}

/**
 * @param {import('express').Express} app
 */
function mountDevTunnelNgrokRoutes(app) {
  app.get('/api/dev-tunnel/ngrok/_probe', (_req, res) => {
    logDevTunnel(_req);
    res.json({ ok: true, probe: true, service: 'omnia-express-dev-tunnel' });
  });

  app.get('/api/dev-tunnel/ngrok/status', (_req, res) => {
    logDevTunnel(_req);
    try {
      const status = getDevTunnelStatus();
      res.json({ ok: true, ...status });
    } catch (e) {
      res.status(500).json({
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  });

  app.post('/api/dev-tunnel/ngrok/start', async (req, res) => {
    try {
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      let ports = [];
      if (Array.isArray(body.ports)) {
        ports = body.ports;
      } else if (body.port != null || body.localPort != null) {
        const p = parsePort(body.port ?? body.localPort);
        if (p != null) ports = [p];
      }
      const hasToken = !!(typeof body.authtoken === 'string' && body.authtoken.trim());
      logDevTunnel(req, { ports, authtokenInBody: hasToken });
      if (!ports.length) {
        return res.status(400).json({ ok: false, error: 'Parametro ports (array di numeri) o port singola obbligatorio.' });
      }
      const authtoken =
        typeof body.authtoken === 'string' && body.authtoken.trim()
          ? body.authtoken.trim()
          : undefined;
      const out = await startTunnelsForPorts({ ports, authtoken });
      res.json({
        ok: true,
        running: true,
        tunnels: out.tunnels,
        ...(out.errors && out.errors.length ? { errors: out.errors } : {}),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const code =
        e && typeof e === 'object' && 'code' in e ? String(/** @type {{ code?: string }} */ (e).code) : '';
      const status =
        code === 'NGROK_SDK_MISSING' || code === 'NGROK_NO_AUTHTOKEN'
          ? 503
          : code === 'INVALID_PORT' || code === 'INVALID_PORTS'
            ? 400
            : 400;
      res.status(status).json({ ok: false, error: msg, code: code || undefined });
    }
  });

  app.post('/api/dev-tunnel/ngrok/stop', async (_req, res) => {
    logDevTunnel(_req);
    try {
      await stopAllTunnels();
      res.json({ ok: true, running: false });
    } catch (e) {
      res.status(500).json({ ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  });
}

module.exports = { mountDevTunnelNgrokRoutes };
