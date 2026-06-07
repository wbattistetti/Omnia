/**
 * Estrae conversationId da body ConvAI o header x-conversation-id.
 */

'use strict';

/**
 * @param {Record<string, unknown>|null|undefined} body
 * @param {import('express').Request} req
 * @returns {string}
 */
function extractConversationId(body, req) {
  const fromBody =
    body && typeof body.conversationId === 'string' ? body.conversationId.trim() : '';
  if (fromBody) return fromBody;
  const hdr =
    req && typeof req.headers['x-conversation-id'] === 'string'
      ? req.headers['x-conversation-id'].trim()
      : '';
  return hdr;
}

module.exports = { extractConversationId };
