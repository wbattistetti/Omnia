/**
 * Gateway runtime ConvAI: POST body → apply sendHints (valueKind) → forward al Backend Call configurato.
 * Generico per qualsiasi task Backend Call (URL da task.endpoint).
 */

'use strict';

const { applySendHintsToBody } = require('./sendHintRuntime/applySendPathToBody');
const { appendInvocation } = require('./convaiWebhookInvocationLogService');
const { stripEmptyConvaiOptionalFieldsInPlace } = require('./convaiOptionalFieldSemantics');

function isRecord(x) {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function readBackendEndpoint(task) {
  const ep = task?.endpoint;
  const url = ep && typeof ep.url === 'string' ? ep.url.trim() : '';
  let method = String(ep?.method ?? 'POST').toUpperCase();
  const urlLower = url.toLowerCase();
  if (urlLower.includes('bookfromagenda') || urlLower.includes('next-window')) {
    method = 'POST';
  }
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
    const started = Date.now();
    const projectId = String(req.params.projectId ?? '').trim();
    const agentTaskId = String(req.params.agentTaskId ?? '').trim();
    const backendTaskId = String(req.params.backendTaskId ?? '').trim();

    if (!projectId || !agentTaskId || !backendTaskId) {
      return res.status(400).json({ error: 'missing_path_params' });
    }

    /** @type {Record<string, unknown>} */
    let logContext = {
      projectId,
      agentTaskId,
      backendTaskId,
      gatewayPath: req.originalUrl || req.url || '',
      forwardMethod: 'POST',
    };

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
      appendInvocation({
        ...logContext,
        backendLabel: String(backendTask.label ?? '').trim() || null,
        upstreamUrl: null,
        durationMs: Date.now() - started,
        error: 'backend_missing_endpoint_url',
      });
      return res.status(502).json({ error: 'backend_missing_endpoint_url' });
    }

    logContext = {
      ...logContext,
      backendLabel: String(backendTask.label ?? '').trim() || null,
      upstreamUrl: targetUrl,
    };

    const hints = agentTask ? parseSendHintsJson(agentTask.agentBackendOutputSlotBindingsJson) : [];

    let bodyObj = isRecord(req.body) ? { ...req.body } : {};
    if (!isRecord(req.body) && typeof req.body === 'string' && req.body.trim()) {
      try {
        bodyObj = JSON.parse(req.body);
      } catch {
        bodyObj = {};
      }
    }

    const requestBodyFromClient = { ...bodyObj };
    /** ConvAI/ElevenLabs: "" su opzionali = omit (regola standard backend webhook). */
    stripEmptyConvaiOptionalFieldsInPlace(bodyObj);

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
    logContext.forwardMethod = forwardMethod;
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
      appendInvocation({
        ...logContext,
        requestBodyFromClient,
        requestBodyAfterSendHints: bodyObj,
        upstreamStatus: upstream.status,
        upstreamResponsePreview: text,
        durationMs: Date.now() - started,
        sendHintsApplied: applied,
        error: upstream.status >= 400 ? `upstream_http_${upstream.status}` : null,
      });
      res.status(upstream.status);
      const ct = upstream.headers.get('content-type');
      if (ct) res.setHeader('content-type', ct);
      return res.send(text);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[convai-webhook-gateway] forward', { targetUrl, err });
      appendInvocation({
        ...logContext,
        requestBodyFromClient,
        requestBodyAfterSendHints: bodyObj,
        durationMs: Date.now() - started,
        sendHintsApplied: applied,
        error: message,
      });
      return res.status(502).json({
        error: 'upstream_forward_failed',
        message,
      });
    }
  };
}

module.exports = {
  createConvaiWebhookGatewayHandler,
  parseSendHintsJson,
  readBackendEndpoint,
};
