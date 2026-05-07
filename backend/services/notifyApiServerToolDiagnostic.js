/**
 * Notifica ApiServer .NET (sessione ElevenLabs host) quando BookFromAgenda risponde con errore HTTP,
 * così readPrompt allega toolDiagnostics e il debugger mostra la card rossa.
 *
 * Usa OMNIA_INTERNAL_TOOL_DIAGNOSTIC_SECRET (Express lo imposta da .env o auto da %TEMP%/omnia-diagnostic-bridge.secret dopo ensureDiagnosticBridgeSecret in server.js).
 * Se il secret non è disponibile, non chiama; in tutti i casi log esplicito con prefisso
 * `[Omnia diagnostic bridge]` (disattivabile con OMNIA_DIAGNOSTIC_BRIDGE_LOG=0).
 */
'use strict';

const http = require('http');
const https = require('https');
const { URL } = require('url');

const LOG_PREFIX = '[Omnia diagnostic bridge]';

function bridgeLoggingEnabled() {
  const v = process.env.OMNIA_DIAGNOSTIC_BRIDGE_LOG;
  return v === undefined || v === '' || v === '1' || String(v).toLowerCase() === 'true';
}

/**
 * @param {'log'|'warn'} level
 * @param {string[]} parts
 */
function logBridge(level, ...parts) {
  if (!bridgeLoggingEnabled()) return;
  const msg = [LOG_PREFIX, ...parts].join(' ');
  if (level === 'warn') console.warn(msg);
  else console.log(msg);
}

/** Suggerimento operativo in base allo status HTTP ApiServer. */
function hintForEnqueueStatus(statusCode) {
  if (statusCode === 403) {
    return 'Check OMNIA_INTERNAL_TOOL_DIAGNOSTIC_SECRET matches on Express and ApiServer.';
  }
  if (statusCode === 404) {
    return 'Hosted ElevenLabs session not found — start the agent from the Omnia debugger so the session (and conversationId alias) is registered.';
  }
  if (statusCode === 400) {
    return 'Enqueue payload rejected by ApiServer (invalid JSON or httpStatus).';
  }
  return 'See ApiServer logs for enqueueToolDiagnostic.';
}

/**
 * @param {{
 *   conversationId: string,
 *   httpStatus: number,
 *   payload: Record<string, unknown> & { error?: string, diagnostic?: unknown },
 * }} args
 * @returns {Promise<{ ok?: boolean, skipped?: boolean, reason?: string, statusCode?: number, body?: string, networkError?: boolean, message?: string }>}
 */
async function notifyApiServerBookFromAgendaFailure(args) {
  const secret = process.env.OMNIA_INTERNAL_TOOL_DIAGNOSTIC_SECRET;
  if (!secret || !String(secret).trim()) {
    logBridge(
      'warn',
      'SKIP:',
      'OMNIA_INTERNAL_TOOL_DIAGNOSTIC_SECRET unset on Express — debugger will not receive BookFromAgenda error cards via enqueue.'
    );
    return { skipped: true, reason: 'OMNIA_INTERNAL_TOOL_DIAGNOSTIC_SECRET unset' };
  }

  const base = (process.env.OMNIA_API_SERVER_URL || 'http://127.0.0.1:5000').replace(/\/$/, '');
  const url = new URL(`${base}/elevenlabs/internal/enqueueToolDiagnostic`);
  const conversationId = args.conversationId && String(args.conversationId).trim();
  if (!conversationId) {
    logBridge(
      'warn',
      'SKIP:',
      'no conversationId — cannot correlate Express error with debugger session.'
    );
    return { skipped: true, reason: 'no conversationId' };
  }

  const p = args.payload && typeof args.payload === 'object' ? args.payload : {};
  const err = typeof p.error === 'string' ? p.error : undefined;
  const bodyObj = {
    conversationId,
    httpStatus: args.httpStatus,
    errorMessage: err,
    diagnostic: p.diagnostic,
    payload: p,
    responsePreview: JSON.stringify(p),
  };
  const body = JSON.stringify(bodyObj);

  logBridge(
    'log',
    'NOTIFY_SEND',
    `conversationId=${conversationId}`,
    `httpStatus=${args.httpStatus}`,
    `target=${url.protocol}//${url.hostname}:${url.port || (url.protocol === 'https:' ? '443' : '80')}${url.pathname}`
  );

  return new Promise((resolve) => {
    const lib = url.protocol === 'https:' ? https : http;
    const port = url.port || (url.protocol === 'https:' ? 443 : 80);
    const req = lib.request(
      {
        hostname: url.hostname,
        port,
        path: `${url.pathname}${url.search || ''}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Length': Buffer.byteLength(body, 'utf8'),
          'X-Omnia-Internal-Tool-Secret': String(secret).trim(),
        },
      },
      (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (c) => {
          data += c;
        });
        res.on('end', () => {
          const code = res.statusCode || 0;
          if (code >= 200 && code < 300) {
            logBridge(
              'log',
              'NOTIFY_OK',
              `conversationId=${conversationId}`,
              `ApiServer HTTP ${code} — tool diagnostic queued for readPrompt.`
            );
            resolve({ ok: true, statusCode: code });
            return;
          }
          const preview = (data || '').slice(0, 500);
          logBridge(
            'warn',
            'NOTIFY_FAIL',
            `conversationId=${conversationId}`,
            `ApiServer HTTP ${code}`,
            hintForEnqueueStatus(code),
            preview ? `body=${preview}` : ''
          );
          resolve({ ok: false, statusCode: code, body: data });
        });
      }
    );
    req.on('error', (err) => {
      const msg = err && err.message ? String(err.message) : String(err);
      logBridge(
        'warn',
        'NOTIFY_NETWORK_ERROR',
        `conversationId=${conversationId}`,
        `target=${url.hostname}:${port}`,
        msg,
        'Check OMNIA_API_SERVER_URL and that ApiServer is running.'
      );
      resolve({ ok: false, networkError: true, message: msg });
    });
    req.write(body);
    req.end();
  });
}

module.exports = { notifyApiServerBookFromAgendaFailure };
