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

/** Minimal payload ConvAI agents/create (allineato a ApiServer VB). */
function buildConvaiAgentCreatePayload(displayName) {
  return {
    name: displayName,
    conversation_config: {
      agent: {
        first_message: 'Hello! How can I help you today?',
        language: 'en',
        prompt: {
          prompt: '',
          llm: 'gpt-4o',
        },
      },
    },
  };
}

function isPlainObject(x) {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

/** Deep-merge `conversation_config` overlay (subset usato dal client Omnia). */
function mergeConvaiConversationConfigFromRequest(payload, requestObj) {
  const overlay = requestObj?.conversation_config;
  if (!isPlainObject(overlay)) return payload;
  const baseCc = isPlainObject(payload.conversation_config) ? payload.conversation_config : {};
  return {
    ...payload,
    conversation_config: deepMergePlainObjects(baseCc, overlay),
  };
}

function deepMergePlainObjects(base, overlay) {
  const out = { ...base };
  for (const [key, val] of Object.entries(overlay)) {
    if (isPlainObject(val) && isPlainObject(out[key])) {
      out[key] = deepMergePlainObjects(out[key], val);
    } else {
      out[key] = val;
    }
  }
  return out;
}

function pickAgentIdFromCreateResponse(data) {
  if (!isPlainObject(data)) return '';
  const direct =
    (typeof data.agent_id === 'string' && data.agent_id.trim()) ||
    (typeof data.agentId === 'string' && data.agentId.trim()) ||
    '';
  if (direct) return direct;
  const agent = data.agent;
  if (isPlainObject(agent)) {
    const nested =
      (typeof agent.agent_id === 'string' && agent.agent_id.trim()) ||
      (typeof agent.agentId === 'string' && agent.agentId.trim()) ||
      '';
    if (nested) return nested;
  }
  return '';
}

/**
 * @param {import('express').Express} app
 */
function mountConvaiAgentsProxyRoutes(app) {
  app.post('/elevenlabs/createAgent', async (req, res) => {
    const apiBase = getElevenLabsBaseUrl();
    try {
      const apiKey = getApiKey();
      if (!apiKey) {
        return sendJson(res, 503, { error: 'ELEVENLABS_API_KEY is not configured.' });
      }
      const requestObj =
        req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
      const displayName = String(requestObj.name ?? '').trim() || 'Omnia ConvAI agent';
      let payload = buildConvaiAgentCreatePayload(displayName);
      payload = mergeConvaiConversationConfigFromRequest(payload, requestObj);
      const elevenLabsRequestJson = JSON.stringify(payload, null, 2);
      const { status, body } = await proxyToElevenLabs(
        'POST',
        '/convai/agents/create',
        JSON.stringify(payload)
      );
      if (status >= 400) {
        console.warn('[elevenlabs:createAgent] upstream', status, body.slice(0, 400));
        let clientStatus = status;
        if (status < 400 || status >= 600) clientStatus = 502;
        else if (status >= 500) clientStatus = 502;
        return sendJson(res, clientStatus, {
          error: 'ElevenLabs agents/create failed.',
          statusCode: status,
          elevenLabsApiBase: apiBase,
          details: body,
          elevenLabsRequestJson,
        });
      }
      let parsed = {};
      try {
        parsed = body.trim() ? JSON.parse(body) : {};
      } catch {
        return sendJson(res, 502, {
          error: 'ElevenLabs response not JSON.',
          elevenLabsApiBase: apiBase,
          details: body,
          elevenLabsRequestJson,
        });
      }
      const agentId = pickAgentIdFromCreateResponse(parsed);
      if (!agentId) {
        return sendJson(res, 502, {
          error: 'ElevenLabs response missing agent_id.',
          elevenLabsApiBase: apiBase,
          details: body,
          elevenLabsRequestJson,
        });
      }
      return sendJson(res, 200, { agentId, elevenLabsRequestJson });
    } catch (err) {
      sendFatal(res, 'createAgent', err, apiBase);
    }
  });

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

  app.post('/elevenlabs/tools', async (req, res) => {
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
      const { status, body } = await proxyToElevenLabs('POST', '/convai/tools', rawBody);
      if (status >= 400) {
        console.warn('[elevenlabs:createTool] upstream', status, body.slice(0, 400));
      }
      res.status(status).type('application/json; charset=utf-8').send(body);
    } catch (err) {
      sendFatal(res, 'createTool', err);
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

  app.get('/elevenlabs/knowledge-base', async (req, res) => {
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
      const upstream = `/convai/knowledge-base?${q.toString()}`;
      const { status, body } = await proxyToElevenLabs('GET', upstream);
      if (status >= 400) {
        console.warn('[elevenlabs:listKb] upstream', status, body.slice(0, 400));
      }
      res.status(status).type('application/json; charset=utf-8').send(body);
    } catch (err) {
      sendFatal(res, 'listKb', err);
    }
  });

  app.post('/elevenlabs/knowledge-base/text', async (req, res) => {
    try {
      const apiKey = getApiKey();
      if (!apiKey) {
        return sendJson(res, 503, { error: 'ELEVENLABS_API_KEY is not configured.' });
      }
      const requestObj =
        req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
      const name = String(requestObj.name ?? '').trim() || 'Omnia KB document';
      const text = String(requestObj.text ?? '').trim();
      if (!text) {
        return sendJson(res, 400, { error: 'text is required' });
      }
      const payload = JSON.stringify({ name, text });
      const { status, body } = await proxyToElevenLabs(
        'POST',
        '/convai/knowledge-base/text',
        payload
      );
      if (status >= 400) {
        console.warn('[elevenlabs:createKbText] upstream', status, body.slice(0, 400));
      }
      res.status(status).type('application/json; charset=utf-8').send(body);
    } catch (err) {
      sendFatal(res, 'createKbText', err);
    }
  });

  app.patch('/elevenlabs/knowledge-base/:documentationId', async (req, res) => {
    const id = String(req.params.documentationId || '').trim();
    if (!id) return sendJson(res, 400, { error: 'documentationId required' });
    try {
      const apiKey = getApiKey();
      if (!apiKey) {
        return sendJson(res, 503, { error: 'ELEVENLABS_API_KEY is not configured.' });
      }
      const requestObj =
        req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
      const name = String(requestObj.name ?? '').trim();
      const content = String(requestObj.content ?? requestObj.text ?? '').trim();
      const payload = JSON.stringify({
        ...(name ? { name } : {}),
        ...(content ? { content } : {}),
      });
      const { status, body } = await proxyToElevenLabs(
        'PATCH',
        `/convai/knowledge-base/${encodeURIComponent(id)}`,
        payload
      );
      if (status >= 400) {
        console.warn('[elevenlabs:patchKbText] upstream', status, 'id=', id, body.slice(0, 400));
      }
      res.status(status).type('application/json; charset=utf-8').send(body);
    } catch (err) {
      sendFatal(res, 'patchKbText', err);
    }
  });

function isElevenLabsKbDocumentNotFound(status, body) {
  if (status !== 404) return false;
  try {
    const parsed = body.trim() ? JSON.parse(body) : {};
    const detail = parsed.detail;
    if (detail && typeof detail === 'object') {
      const code = String(detail.code ?? detail.status ?? '').trim();
      if (code === 'document_not_found') return true;
    }
  } catch {
    /* ignore parse errors */
  }
  return /document_not_found|not found/i.test(String(body ?? ''));
}

  app.delete('/elevenlabs/knowledge-base/:documentationId', async (req, res) => {
    const id = String(req.params.documentationId || '').trim();
    if (!id) return sendJson(res, 400, { error: 'documentationId required' });
    try {
      const apiKey = getApiKey();
      if (!apiKey) {
        return sendJson(res, 503, { error: 'ELEVENLABS_API_KEY is not configured.' });
      }
      const force = String(req.query.force ?? '').toLowerCase() === 'true';
      const upstream = `/convai/knowledge-base/${encodeURIComponent(id)}${force ? '?force=true' : ''}`;
      const { status, body } = await proxyToElevenLabs('DELETE', upstream);
      if (isElevenLabsKbDocumentNotFound(status, body)) {
        return res.status(204).end();
      }
      if (status >= 400) {
        console.warn('[elevenlabs:deleteKb] upstream', status, 'id=', id, body.slice(0, 400));
      }
      res.status(status).type('application/json; charset=utf-8').send(body);
    } catch (err) {
      sendFatal(res, 'deleteKb', err);
    }
  });

  app.delete('/elevenlabs/agents/:agentId', async (req, res) => {
    const apiBase = getElevenLabsBaseUrl();
    const id = String(req.params.agentId || '').trim();
    if (!id) return sendJson(res, 400, { error: 'agentId required' });
    try {
      const apiKey = getApiKey();
      if (!apiKey) {
        return sendJson(res, 503, { error: 'ELEVENLABS_API_KEY is not configured.' });
      }
      const { status, body } = await proxyToElevenLabs('DELETE', `/convai/agents/${encodeURIComponent(id)}`);
      if (status >= 400) {
        console.warn('[elevenlabs:deleteAgent] upstream', status, 'agentId=', id, body.slice(0, 400));
        let clientStatus = status;
        if (status < 400 || status >= 600) clientStatus = 502;
        else if (status >= 500) clientStatus = 502;
        return sendJson(res, clientStatus, {
          error: 'ElevenLabs agents/delete failed.',
          statusCode: status,
          elevenLabsApiBase: apiBase,
          details: body,
          phase: 'delete',
        });
      }
      res.status(status).type('application/json; charset=utf-8').send(body);
    } catch (err) {
      sendFatal(res, 'deleteAgent', err, apiBase);
    }
  });

  console.log(
    '[iaCatalog] ElevenLabs ConvAI proxy: createAgent, agents, tools, knowledge-base (list/text/patch/delete)'
  );
}

module.exports = { mountConvaiAgentsProxyRoutes };
