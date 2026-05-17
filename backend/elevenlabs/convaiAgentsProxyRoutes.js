/**
 * Dev-time proxy for ElevenLabs ConvAI agent CRUD (same paths as VB ApiServer).
 * Used when `dev:beNew` runs Express :3100 without ApiServer :5000.
 *
 * Upstream paths use `/convai/...` (not `/v1/convai/...`): `getElevenLabsBaseUrl()`
 * from `ELEVENLABS_API_BASE` already includes `/v1` (same as ia-catalog sync).
 */

const { getElevenLabsBaseUrl } = require('../services/iaCatalog/elevenLabsEndpoint');

function getApiKey() {
  const key = typeof process.env.ELEVENLABS_API_KEY === 'string' ? process.env.ELEVENLABS_API_KEY.trim() : '';
  return key;
}

/**
 * @param {import('express').Response} res
 * @param {number} status
 * @param {Record<string, unknown>} body
 */
function sendJson(res, status, body) {
  res.status(status).type('application/json; charset=utf-8').json(body);
}

/**
 * @param {import('express').Response} res
 * @param {string} phase
 * @param {Error | unknown} err
 * @param {string} [apiBase]
 */
function sendFatal(res, phase, err, apiBase = '') {
  const ex = err instanceof Error ? err : new Error(String(err));
  console.error(`[elevenlabs:${phase}]`, ex.message);
  sendJson(res, 500, {
    error: `ElevenLabs ${phase} failed (Express proxy / upstream).`,
    phase,
    detail: ex.message,
    elevenLabsApiBase: apiBase || getElevenLabsBaseUrl(),
    details: ex.stack || ex.message,
  });
}

/**
 * @param {string} method
 * @param {string} upstreamPath
 * @param {string | null} [body]
 */
async function proxyToElevenLabs(method, upstreamPath, body = null) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { status: 503, body: JSON.stringify({ error: 'ELEVENLABS_API_KEY is not configured.' }) };
  }
  const apiBase = getElevenLabsBaseUrl();
  const url = `${apiBase.replace(/\/+$/, '')}${upstreamPath}`;
  const headers = { 'xi-api-key': apiKey };
  const init = { method, headers };
  if (body != null && body !== '') {
    headers['Content-Type'] = 'application/json; charset=utf-8';
    init.body = body;
  }
  const res = await fetch(url, init);
  const text = await res.text();
  return { status: res.status, body: text };
}

/**
 * @param {import('express').Express} app
 */
function mountConvaiAgentsProxyRoutes(app) {
  app.get('/elevenlabs/agents', async (req, res) => {
    const apiBase = getElevenLabsBaseUrl();
    try {
      const apiKey = getApiKey();
      if (!apiKey) {
        return sendJson(res, 503, { error: 'ELEVENLABS_API_KEY is not configured.' });
      }
      const q = new URLSearchParams();
      const pageSize = String(req.query.page_size || '30').trim() || '30';
      q.set('page_size', pageSize);
      if (req.query.cursor) q.set('cursor', String(req.query.cursor));
      if (req.query.search) q.set('search', String(req.query.search));
      const upstream = `/convai/agents?${q.toString()}`;
      const { status, body } = await proxyToElevenLabs('GET', upstream);
      if (status >= 400) {
        console.warn('[elevenlabs:listAgents] upstream', status, body.slice(0, 400));
      }
      res.status(status).type('application/json; charset=utf-8').send(body);
    } catch (err) {
      sendFatal(res, 'listAgents', err, apiBase);
    }
  });

  app.get('/elevenlabs/agents/:agentId', async (req, res) => {
    const id = String(req.params.agentId || '').trim();
    if (!id) return sendJson(res, 400, { error: 'agentId required' });
    try {
      const apiKey = getApiKey();
      if (!apiKey) {
        return sendJson(res, 503, { error: 'ELEVENLABS_API_KEY is not configured.' });
      }
      const { status, body } = await proxyToElevenLabs('GET', `/convai/agents/${encodeURIComponent(id)}`);
      res.status(status).type('application/json; charset=utf-8').send(body);
    } catch (err) {
      sendFatal(res, 'getAgent', err);
    }
  });

  app.patch('/elevenlabs/agents/:agentId', async (req, res) => {
    const id = String(req.params.agentId || '').trim();
    if (!id) return sendJson(res, 400, { error: 'agentId required' });
    try {
      const apiKey = getApiKey();
      if (!apiKey) {
        return sendJson(res, 503, { error: 'ELEVENLABS_API_KEY is not configured.' });
      }
      const rawBody =
        typeof req.body === 'string'
          ? req.body
          : req.body && typeof req.body === 'object'
            ? JSON.stringify(req.body)
            : '';
      const { status, body } = await proxyToElevenLabs(
        'PATCH',
        `/convai/agents/${encodeURIComponent(id)}`,
        rawBody
      );
      res.status(status).type('application/json; charset=utf-8').send(body);
    } catch (err) {
      sendFatal(res, 'patchAgent', err);
    }
  });

  app.get('/elevenlabs/tools', async (req, res) => {
    try {
      const apiKey = getApiKey();
      if (!apiKey) {
        return sendJson(res, 503, { error: 'ELEVENLABS_API_KEY is not configured.' });
      }
      const q = new URLSearchParams();
      const pageSize = String(req.query.page_size || '100').trim() || '100';
      q.set('page_size', pageSize);
      if (req.query.cursor) q.set('cursor', String(req.query.cursor));
      if (req.query.search) q.set('search', String(req.query.search));
      if (req.query.types) q.set('types', String(req.query.types));
      const upstream = `/convai/tools?${q.toString()}`;
      const { status, body } = await proxyToElevenLabs('GET', upstream);
      res.status(status).type('application/json; charset=utf-8').send(body);
    } catch (err) {
      sendFatal(res, 'listTools', err);
    }
  });

  app.get('/elevenlabs/tools/:toolId', async (req, res) => {
    const id = String(req.params.toolId || '').trim();
    if (!id) return sendJson(res, 400, { error: 'toolId required' });
    try {
      const apiKey = getApiKey();
      if (!apiKey) {
        return sendJson(res, 503, { error: 'ELEVENLABS_API_KEY is not configured.' });
      }
      const { status, body } = await proxyToElevenLabs('GET', `/convai/tools/${encodeURIComponent(id)}`);
      res.status(status).type('application/json; charset=utf-8').send(body);
    } catch (err) {
      sendFatal(res, 'getTool', err);
    }
  });

  app.delete('/elevenlabs/agents/:agentId', async (req, res) => {
    const id = String(req.params.agentId || '').trim();
    if (!id) return sendJson(res, 400, { error: 'agentId required' });
    try {
      const apiKey = getApiKey();
      if (!apiKey) {
        return sendJson(res, 503, { error: 'ELEVENLABS_API_KEY is not configured.' });
      }
      const { status, body } = await proxyToElevenLabs('DELETE', `/convai/agents/${encodeURIComponent(id)}`);
      res.status(status).type('application/json; charset=utf-8').send(body);
    } catch (err) {
      sendFatal(res, 'deleteAgent', err);
    }
  });

  console.log('[iaCatalog] ElevenLabs ConvAI tools proxy: GET /elevenlabs/tools');
}

module.exports = { mountConvaiAgentsProxyRoutes };
