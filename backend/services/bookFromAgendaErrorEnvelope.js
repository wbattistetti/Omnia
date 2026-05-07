/**
 * Risposte JSON strutturate per POST BookFromAgenda: timeline pipeline, validazione, codici.
 * Usato dal client ConvAI e documentabile nel debugger quando il body è disponibile.
 */

'use strict';

/** @param {unknown} x */
function isRecord(x) {
  return !!x && typeof x === 'object' && !Array.isArray(x);
}

/**
 * @param {string} msg
 * @returns {'client'|'server'}
 */
function tierFromMessage(msg) {
  if (msg.startsWith('bookfromagenda:') || msg.startsWith('scheduling:')) return 'client';
  return 'server';
}

/**
 * @param {string} msg
 * @returns {string|undefined}
 */
function inferCode(msg) {
  if (msg.includes('queryConstraints must be') || msg.includes('query (alias of queryConstraints)')) {
    return 'bookfromagenda_query_constraints_type';
  }
  if (msg.includes('body must be a JSON object')) return 'bookfromagenda_body_not_object';
  if (msg.includes('horizon')) return 'bookfromagenda_horizon';
  if (msg.includes('agenda')) return 'bookfromagenda_agenda_source';
  if (msg.startsWith('scheduling:')) return 'scheduling_constraint';
  return undefined;
}

/**
 * @param {string} code
 * @returns {string|undefined}
 */
function hintForCode(code) {
  if (code === 'bookfromagenda_query_constraints_type') {
    return (
      'Invia queryConstraints come oggetto JSON nel body POST (non una stringa). ' +
      'Campi tipici: weekdays (array 0–6), horizon { start, end }, allowedIntervals, forbiddenIntervals. ' +
      'OpenAPI: GET …/bookfromagenda/openapi.json → SchedulingQueryConstraints.'
    );
  }
  return undefined;
}

/**
 * Costruisce timeline e riepilogo per il payload di errore HTTP.
 * @param {{
 *   message: string,
 *   req?: import('express').Request,
 *   attached?: Record<string, unknown>,
 * }} opts
 */
function buildBookFromAgendaErrorEnvelope(opts) {
  const message = String(opts.message || 'Errore sconosciuto');
  const tier = tierFromMessage(message);
  const status = tier === 'client' ? 400 : 500;
  const code = inferCode(message);
  const hint = code ? hintForCode(code) : undefined;

  const attached = opts.attached && isRecord(opts.attached) ? opts.attached : {};
  const failedStage =
    typeof attached.failedStage === 'string' ? attached.failedStage : inferFailedStage(message);

  const shapeError =
    message.includes('queryConstraints must be') ||
    message.includes('query (alias of queryConstraints)');
  const bodyError = message.includes('body must be a JSON object');

  /** Punto di rottura: shape prima di altri `bookfromagenda:` (che includono anche errori di solve). */
  let failId = bodyError
    ? 'coerce'
    : shapeError
      ? 'query_constraints_shape'
      : message.startsWith('bookfromagenda:') || message.startsWith('scheduling:')
        ? 'solve'
        : 'unexpected';

  /** @type {Array<{ id: string, label: string, status: 'ok'|'failed'|'skipped', detail?: string }>} */
  const rawSteps = [
    {
      id: 'ingress',
      label: 'Richiesta HTTP ricevuta (handler Express)',
      detail: opts.req?.method && opts.req?.path ? `${opts.req.method} ${opts.req.path}` : undefined,
    },
    {
      id: 'tunnel',
      label: 'Tunnel / proxy — richiesta arrivata al processo Node',
    },
    {
      id: 'coerce',
      label: 'Middleware: coerce tipi + normalizzazione (conversationId, forceRefresh, …)',
    },
    {
      id: 'query_constraints_shape',
      label: 'Validazione tipo queryConstraints / query (oggetto JSON, non stringa)',
    },
    {
      id: 'solve',
      label: 'Materializzazione agenda + filtro vincoli (solve)',
    },
  ];

  const orderIds = rawSteps.map((s) => s.id);
  const fi = orderIds.indexOf(failId);
  /** Eccezione fuori dalla pipeline nota: fallisce allo step solve con messaggio completo. */
  if (fi < 0) {
    failId = 'solve';
  }
  const failIndex = orderIds.indexOf(failId);

  const timeline = rawSteps.map((s, i) => {
    const id = s.id;
    let status = /** @type {'ok'|'failed'|'skipped'} */ ('ok');
    let detail = s.detail;
    if (i < failIndex) status = 'ok';
    else if (i === failIndex) {
      status = 'failed';
      if (id === 'coerce') detail = message.slice(0, 240);
      else if (id === 'query_constraints_shape')
        detail = 'Atteso oggetto; ricevuta stringa o tipo non oggetto.';
      else if (id === 'solve') detail = message.slice(0, 360);
    } else {
      status = 'skipped';
      detail = 'Non eseguito (errore nello step precedente).';
    }
    return { id, label: s.label, ok: status === 'ok', status, ...(detail ? { detail } : {}) };
  });

  /** @type {Record<string, unknown>} */
  const diagnostic = {
    schemaVersion: 1,
    kind: 'bookfromagenda.error',
    tier,
    route: 'POST /api/runtime/bookfromagenda',
    timeline,
    summary: {
      outcome: 'error',
      failedStepId: failId,
      failedStage: failedStage || failId,
      httpStatus: status,
    },
  };

  if (attached.fields && isRecord(attached.fields)) {
    diagnostic.validation = {
      fields: attached.fields,
    };
  }

  /** @type {Record<string, unknown>} */
  const payload = {
    ok: false,
    error: message,
    diagnostic,
  };

  if (code) payload.code = code;
  if (hint) payload.hint = hint;

  return { status, payload };
}

/**
 * @param {string} msg
 */
function inferFailedStage(msg) {
  if (msg.includes('queryConstraints must be') || msg.includes('query (alias of queryConstraints)')) {
    return 'query_constraints_shape';
  }
  return '';
}

/**
 * @param {unknown} err
 * @param {import('express').Request | undefined} req
 */
function envelopeFromCaughtBookFromAgendaError(err, req) {
  const message = err instanceof Error ? err.message : String(err);
  /** @type {Record<string, unknown>|undefined} */
  let attached;
  if (err instanceof Error && 'bfaDiagnostic' in err && isRecord((/** @type {*} */ (err)).bfaDiagnostic)) {
    attached = /** @type {Record<string, unknown>} */ ((/** @type {*} */ (err)).bfaDiagnostic);
  }
  return buildBookFromAgendaErrorEnvelope({ message, req, attached });
}

module.exports = {
  buildBookFromAgendaErrorEnvelope,
  envelopeFromCaughtBookFromAgendaError,
  inferCode,
};
