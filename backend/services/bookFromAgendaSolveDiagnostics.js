/**
 * Diagnostica strutturata per POST BookFromAgenda dopo coercizione/normalize e dentro solveBookFromAgenda.
 * Disabilita con `OMNIA_TRACE_BOOKFROMAGENDA=0` (stesso flag della trace HTTP {@link bookFromAgendaRuntimeTrace}).
 */

'use strict';

const { isBookFromAgendaTraceDisabled, maxBodyChars, previewForLog } = require('../middleware/bookFromAgendaRuntimeTrace');
const {
  buildScopePersistenceKey,
  extractForceRefresh,
  fingerprintFromBody,
  getRedisStorageKey,
  hasAgendaSource,
} = require('./bookFromAgendaSlotCache');

const PREFIX = '[Omnia·BookFromAgenda·SOLVE]';

function headerTrim(req, name) {
  const raw = req.headers && req.headers[name];
  return typeof raw === 'string' ? raw.trim() : '';
}

/**
 * Dopo `coerceBookFromAgendaRequestBody` e `normalizeBookFromAgendaIncomingBody`.
 *
 * @param {Record<string, unknown>} body
 * @param {import('express').Request | { headers?: Record<string, unknown> }} req
 */
function logAfterNormalize(body, req) {
  if (isBookFromAgendaTraceDisabled()) return;

  const hdrConv =
    headerTrim(req, 'x-omnia-conversation-id') || headerTrim(req, 'x-convai-conversation-id');
  const hdrProj = headerTrim(req, 'x-omnia-project-id');

  const conv =
    typeof body.conversationId === 'string' ? body.conversationId : `(type:${typeof body.conversationId})`;
  const proj =
    typeof body.projectId === 'string' ? body.projectId : `(type:${typeof body.projectId})`;
  const fr = body.forceRefresh;
  const src = hasAgendaSource(body);

  console.log(`${PREFIX} post-coerce+normalize`, {
    conversationId: conv,
    projectId: proj,
    forceRefresh: fr,
    forceRefreshType: typeof fr,
    hasAgendaSource: src,
    headersHint: {
      filledConversationFromHeader: !!hdrConv,
      filledProjectFromHeader: !!hdrProj,
    },
  });

  console.log(`${PREFIX} body preview`, previewForLog(body, maxBodyChars()));

  if (!src && fr === true) {
    console.warn(
      `${PREFIX} note: no agenda.url/json — forceRefresh does not trigger refetch; Redis snapshot only`
    );
  }
}

/**
 * Snapshot unico all’ingresso di solveBookFromAgenda (chiave Redis e fingerprint).
 *
 * @param {Record<string, unknown>} body
 */
function logSolveEntry(body) {
  if (isBookFromAgendaTraceDisabled()) return;

  let persistenceKey = '';
  try {
    persistenceKey = buildScopePersistenceKey(body);
  } catch (e) {
    persistenceKey = `(error: ${e && e.message ? e.message : String(e)})`;
  }

  let frResolved;
  try {
    frResolved = extractForceRefresh(body);
  } catch (e) {
    frResolved = `(error: ${e && e.message ? e.message : String(e)})`;
  }

  let fpShort = '';
  try {
    if (hasAgendaSource(body)) {
      fpShort = fingerprintFromBody(body).slice(0, 24);
    }
  } catch {
    fpShort = '(n/a)';
  }

  const redisStorage =
    persistenceKey && typeof persistenceKey === 'string' && !persistenceKey.startsWith('(')
      ? getRedisStorageKey(persistenceKey)
      : '';

  console.log(`${PREFIX} solve entry`, {
    persistenceKey,
    redisStorageKey: redisStorage || '(no scope)',
    forceRefreshResolved: frResolved,
    forceRefreshResolvedType: typeof frResolved,
    hasAgendaSource: hasAgendaSource(body),
    sourceFingerprintPrefix24: fpShort,
  });
}

/**
 * @param {string} decision
 * @param {Record<string, unknown>} [extra]
 */
function logSolveDecision(decision, extra) {
  if (isBookFromAgendaTraceDisabled()) return;
  console.log(`${PREFIX} decision → ${decision}`, extra || {});
}

module.exports = {
  logAfterNormalize,
  logSolveEntry,
  logSolveDecision,
  PREFIX,
};
