/**
 * Gateway runtime ConvAI: POST body → apply sendHints (valueKind) → forward al Backend Call configurato.
 * Generico per qualsiasi task Backend Call (URL da task.endpoint).
 */

'use strict';

const { applySendHintsToBody } = require('./sendHintRuntime/applySendPathToBody');

function isRecord(x) {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function readBackendEndpoint(task) {
  const ep = task?.endpoint;
  const url = ep && typeof ep.url === 'string' ? ep.url.trim() : '';
  const method = String(ep?.method ?? 'POST').toUpperCase();
  const headers = {};
  if (ep?.headers && typeof ep.headers === 'object') {
    for (const [k, v] of Object.entries(ep.headers)) {
      if (typeof v === 'string' && v.trim()) headers[k] = v.trim();
    }
  }
  return { url, method, headers };
}

function parseSendHintsJson(raw) {
  if (!raw || !String(raw).trim()) return [];
  try {
    const o = JSON.parse(String(raw));
    if (!o || typeof o !== 'object') return [];
    const arr = Array.isArray(o.sendHints) ? o.sendHints : [];
    return arr
      .map((h) => {
        if (!h || typeof h !== 'object') return null;
        const surface = String(h.surface ?? '').trim().toLowerCase();
        const sendPath = String(h.sendPath ?? '').trim();
        const valueKind = typeof h.valueKind === 'string' && h.valueKind.trim() ? h.valueKind.trim() : undefined;
        if (!surface || !sendPath) return null;
        return {
          surface,
          slotId: String(h.slotId ?? '').trim().toLowerCase(),
          role: h.role === 'constraint' ? 'constraint' : 'value',
          sendPath,
          ...(valueKind ? { valueKind } : {}),
        };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function isHopByHopHeader(name) {
  const h = String(name || '').toLowerCase();
  return ['host', 'connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'content-length'].includes(h);
}

/**
 * @param {object} deps
 * @param {(projectId: string, taskId: string) => Promise<object|null>} deps.loadProjectTask
 */
function createConvaiWebhookGatewayHandler(deps) {
  const { loadProjectTask } = deps;

  return async function handleConvaiWebhookGateway(req, res) {
    const projectId = String(req.params.projectId ?? '').trim();
    const agentTaskId = String(req.params.agentTaskId ?? '').trim();
    const backendTaskId = String(req.params.backendTaskId ?? '').trim();

    if (!projectId || !agentTaskId || !backendTaskId) {
      return res.status(400).json({ error: 'missing_path_params' });
    }

    let agentTask;
    let backendTask;
    try {
      agentTask = await loadProjectTask(projectId, agentTaskId);
      backendTask = await loadProjectTask(projectId, backendTaskId);
    } catch (err) {
      console.error('[convai-webhook-gateway] load task', err);
      return res.status(500).json({ error: 'task_load_failed' });
    }

    if (!backendTask) {
      return res.status(404).json({ error: 'backend_task_not_found', backendTaskId });
    }

    const { url: targetUrl, method: targetMethod, headers: targetHeaders } = readBackendEndpoint(backendTask);
    if (!targetUrl) {
      return res.status(502).json({ error: 'backend_missing_endpoint_url' });
    }

    const hints = agentTask ? parseSendHintsJson(agentTask.agentBackendOutputSlotBindingsJson) : [];

    let bodyObj = isRecord(req.body) ? { ...req.body } : {};
    if (!isRecord(req.body) && typeof req.body === 'string' && req.body.trim()) {
      try {
        bodyObj = JSON.parse(req.body);
      } catch {
        bodyObj = {};
      }
    }

    const applied = applySendHintsToBody(bodyObj, hints, { referenceDate: new Date() });
    if (applied > 0) {
      console.log('[convai-webhook-gateway] applied sendHints', {
        projectId,
        agentTaskId,
        backendTaskId,
        applied,
      });
    }

    const forwardMethod = targetMethod || 'POST';
    const forwardHeaders = new Headers();
    for (const [k, v] of Object.entries(targetHeaders)) {
      if (!isHopByHopHeader(k)) forwardHeaders.set(k, v);
    }
    for (const [k, v] of Object.entries(req.headers)) {
      const hn = String(k);
      if (isHopByHopHeader(hn)) continue;
      if (hn.toLowerCase().startsWith('x-omnia-gateway')) continue;
      if (!forwardHeaders.has(hn)) forwardHeaders.set(hn, String(v));
    }
    forwardHeaders.set('content-type', 'application/json');

    const bodyMayHaveContent = forwardMethod !== 'GET' && forwardMethod !== 'HEAD';
    const fetchInit = {
      method: forwardMethod,
      headers: forwardHeaders,
      ...(bodyMayHaveContent ? { body: JSON.stringify(bodyObj) } : {}),
    };

    try {
      const upstream = await fetch(targetUrl, fetchInit);
      const text = await upstream.text();
      res.status(upstream.status);
      const ct = upstream.headers.get('content-type');
      if (ct) res.setHeader('content-type', ct);
      return res.send(text);
    } catch (err) {
      console.error('[convai-webhook-gateway] forward', { targetUrl, err });
      return res.status(502).json({
        error: 'upstream_forward_failed',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };
}

module.exports = {
  createConvaiWebhookGatewayHandler,
  parseSendHintsJson,
  readBackendEndpoint,
};
