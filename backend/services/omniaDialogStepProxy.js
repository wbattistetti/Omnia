'use strict';

/**
 * Proxy Express → ApiServer VB per omnia_dialog_step (motore migrato in .NET).
 * Registra invocazioni su convai_runtime_invocations.json (schema V2) per debugger UI.
 */

const DEFAULT_API_SERVER = 'http://127.0.0.1:5000';
const {
  recordConvaiRuntimeInvocation,
  buildDialogStepDraft,
} = require('./convaiRuntimeInvocationLog');
const { extractConversationId } = require('./convaiRuntimeInvocationLog/extractConversationId');

function resolveApiServerBase() {
  return String(process.env.OMNIA_API_SERVER_URL || DEFAULT_API_SERVER).replace(/\/$/, '');
}

function parseResponseJson(text) {
  if (!text || !String(text).trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function proxyOmniaDialogStepToApiServer(req, res) {
  const started = Date.now();
  const base = resolveApiServerBase();
  const projectId = String(req.params.projectId ?? '').trim();
  const agentTaskId = String(req.params.agentTaskId ?? '').trim();
  const gatewayPath = req.originalUrl || req.url || '';
  const url = `${base}/api/runtime/omnia-dialog-step/${encodeURIComponent(projectId)}/${encodeURIComponent(agentTaskId)}`;

  const bodyObj =
    req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  const conversationId = extractConversationId(bodyObj, req);

  const headers = { 'Content-Type': 'application/json' };
  if (conversationId) headers['x-conversation-id'] = conversationId;

  const logBase = {
    projectId: projectId || null,
    agentTaskId: agentTaskId || null,
    conversationId: conversationId || null,
    gatewayPath,
    requestBodyFromClient: bodyObj,
    durationMs: 0,
  };

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(bodyObj),
    });
    const text = await upstream.text();
    const responseBody = parseResponseJson(text);
    const httpStatus = upstream.status;

    try {
      recordConvaiRuntimeInvocation(
        buildDialogStepDraft({
          ...logBase,
          httpStatus,
          responseBody,
          durationMs: Date.now() - started,
          error: httpStatus >= 400 ? `http_${httpStatus}` : null,
        })
      );
    } catch (logErr) {
      console.warn('[omnia-dialog-step proxy→VB] runtime log persist failed', logErr);
    }

    res.status(httpStatus);
    res.set('Content-Type', upstream.headers.get('content-type') || 'application/json; charset=utf-8');
    return res.send(text);
  } catch (err) {
    console.error('[omnia-dialog-step proxy→VB]', err);
    const message = err instanceof Error ? err.message : String(err);
    try {
      recordConvaiRuntimeInvocation(
        buildDialogStepDraft({
          ...logBase,
          httpStatus: 502,
          responseBody: {
            status: 'error',
            error: 'omnia_dialog_step_proxy_failed',
          },
          durationMs: Date.now() - started,
          error: message,
        })
      );
    } catch (logErr) {
      console.warn('[omnia-dialog-step proxy→VB] runtime log persist failed', logErr);
    }
    return res.status(502).json({
      status: 'error',
      error: 'omnia_dialog_step_proxy_failed',
      say: 'Runtime dialogo non raggiungibile. Verificare ApiServer .NET.',
    });
  }
}

module.exports = { proxyOmniaDialogStepToApiServer, resolveApiServerBase };
