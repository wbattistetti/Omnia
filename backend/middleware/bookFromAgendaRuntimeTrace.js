/**
 * Traccia richieste verso `/api/runtime/bookfromagenda*` nel terminale Express con prefisso fisso,
 * per verificare se webhook/ngrok/ElevenLabs raggiungono il processo Node.
 *
 * Diagnostica pipeline solver (chiave Redis, forceRefresh, branch): `[Omnia·BookFromAgenda·SOLVE]`
 * in `bookFromAgendaSolveDiagnostics.js` — stesso flag di disabilitazione.
 *
 * Disabilita tutta la trace BookFromAgenda: `OMNIA_TRACE_BOOKFROMAGENDA=0`
 * Limite lunghezza body log (caratteri): `OMNIA_TRACE_BOOKFROMAGENDA_BODY_MAX_CHARS` (default 24576)
 */

const PREFIX = '[Omnia·BookFromAgenda·HTTP]';

/** Header names (lowercase) whose values must not appear in logs */
const SENSITIVE_HEADER_NAMES = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
]);

function isBookFromAgendaRuntimePath(p) {
  return typeof p === 'string' && p.startsWith('/api/runtime/bookfromagenda');
}

function traceDisabled() {
  const v = process.env.OMNIA_TRACE_BOOKFROMAGENDA;
  return v === '0' || v === 'false';
}

function maxBodyChars() {
  const raw = process.env.OMNIA_TRACE_BOOKFROMAGENDA_BODY_MAX_CHARS;
  const n = raw != null && raw !== '' ? Number.parseInt(String(raw), 10) : NaN;
  if (Number.isFinite(n) && n > 0) return n;
  return 24576;
}

/**
 * @param {unknown} value
 * @param {number} maxLen
 */
function previewForLog(value, maxLen) {
  try {
    let s;
    if (typeof value === 'string') {
      s = value;
    } else if (Buffer.isBuffer(value)) {
      s = value.toString('utf8');
    } else {
      s = JSON.stringify(value);
    }
    if (s.length <= maxLen) return s;
    return `${s.slice(0, maxLen)}… (+${s.length - maxLen} chars)`;
  } catch (e) {
    return `[unserializable: ${e && e.message ? e.message : String(e)}]`;
  }
}

/**
 * @param {import('express').Request} req
 */
function sanitizeRequestHeaders(req) {
  const headers = req.headers || {};
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const [name, val] of Object.entries(headers)) {
    const lower = name.toLowerCase();
    if (SENSITIVE_HEADER_NAMES.has(lower)) {
      out[name] = '[redacted]';
    } else {
      out[name] = val;
    }
  }
  return out;
}

/**
 * Intercetta `res.json` / `res.send` per loggare il payload restituito al client.
 * @param {import('express').Response} res
 * @param {(body: unknown) => void} onOutgoing
 */
function attachResponseCapture(res, onOutgoing) {
  let captured;

  const origJson = res.json.bind(res);
  res.json = function jsonWrap(body) {
    captured = body;
    return origJson(body);
  };

  const origSend = res.send.bind(res);
  res.send = function sendWrap(body) {
    if (captured === undefined) {
      captured = body;
    }
    return origSend(body);
  };

  res.on('finish', () => {
    onOutgoing(captured);
  });
}

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function bookFromAgendaRuntimeTrace(req, res, next) {
  if (traceDisabled()) {
    next();
    return;
  }
  if (!isBookFromAgendaRuntimePath(req.path)) {
    next();
    return;
  }

  const started = Date.now();
  const url = req.originalUrl || req.url || '';
  const maxLen = maxBodyChars();

  const incomingBody =
    req.body === undefined
      ? undefined
      : previewForLog(req.body, maxLen);

  console.log(`${PREFIX} → IN`, req.method, url);
  console.log(`${PREFIX} → IN headers`, sanitizeRequestHeaders(req));
  console.log(`${PREFIX} → IN body`, incomingBody);

  attachResponseCapture(res, (outgoing) => {
    const ms = Date.now() - started;
    const outStr =
      outgoing === undefined ? '(no body captured)' : previewForLog(outgoing, maxLen);
    console.log(`${PREFIX} ← OUT`, req.method, url, `status=${res.statusCode}`, `${ms}ms`);
    console.log(`${PREFIX} ← OUT body`, outStr);
  });

  next();
}

/** Usato da diagnostica solve: stesso flag `OMNIA_TRACE_BOOKFROMAGENDA=0` per silenziare tutto. */
function isBookFromAgendaTraceDisabled() {
  return traceDisabled();
}

module.exports = {
  bookFromAgendaRuntimeTrace,
  isBookFromAgendaRuntimePath,
  isBookFromAgendaTraceDisabled,
  maxBodyChars,
  previewForLog,
};
