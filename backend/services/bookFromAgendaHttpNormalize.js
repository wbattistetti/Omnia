/**
 * Normalizza il body HTTP POST BookFromAgenda prima del solver: scope da header opzionali,
 * campi scope di default, forceRefresh dedotto se assente.
 */

'use strict';

const { hasAgendaSource } = require('./bookFromAgendaSlotCache');

/**
 * @param {import('express').Request | { headers?: Record<string, unknown> }} req
 * @param {string} name
 */
function headerTrim(req, name) {
  const raw = req.headers && req.headers[name];
  if (typeof raw !== 'string') return '';
  return raw.trim();
}

/**
 * @param {Record<string, unknown>} body
 * @param {import('express').Request | { headers?: Record<string, unknown> }} req
 */
function normalizeBookFromAgendaIncomingBody(body, req) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return;

  const hdrConv =
    headerTrim(req, 'x-omnia-conversation-id') ||
    headerTrim(req, 'x-convai-conversation-id');
  if (hdrConv && (!('conversationId' in body) || body.conversationId === '')) {
    body.conversationId = hdrConv;
  }

  const hdrProj = headerTrim(req, 'x-omnia-project-id');
  if (hdrProj && (!('projectId' in body) || body.projectId === '')) {
    body.projectId = hdrProj;
  }

  if (!('conversationId' in body)) body.conversationId = '';
  if (!('projectId' in body)) body.projectId = '';

  if (!('forceRefresh' in body)) {
    body.forceRefresh = hasAgendaSource(body);
  }

  const convTrim =
    typeof body.conversationId === 'string' ? body.conversationId.trim() : '';
  if (!convTrim) {
    throw new Error(
      'bookfromagenda: conversationId is required at runtime (non-empty string, or header x-omnia-conversation-id / x-convai-conversation-id)'
    );
  }
}

module.exports = {
  normalizeBookFromAgendaIncomingBody,
};
