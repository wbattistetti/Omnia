/**
 * Query log invocazioni runtime ConvAI (schema V2).
 */

'use strict';

const { readLog, MAX_RECORDS } = require('./persist');

/**
 * @param {object} [filters]
 * @param {string} [filters.conversationId]
 * @param {string} [filters.kind]
 * @param {string} [filters.projectId]
 * @param {string} [filters.agentTaskId]
 * @param {string} [filters.backendTaskId]
 * @param {string} [filters.since] ISO timestamp inclusive
 * @param {string} [filters.until] ISO timestamp inclusive
 * @param {number} [filters.limit]
 */
function listConvaiRuntimeInvocations(filters = {}) {
  const cap =
    Number.isFinite(filters.limit) && filters.limit > 0
      ? Math.min(filters.limit, MAX_RECORDS)
      : MAX_RECORDS;

  const conversationId = String(filters.conversationId ?? '').trim();
  const kind = String(filters.kind ?? '').trim();
  const projectId = String(filters.projectId ?? '').trim();
  const agentTaskId = String(filters.agentTaskId ?? '').trim();
  const backendTaskId = String(filters.backendTaskId ?? '').trim();
  const since = String(filters.since ?? '').trim();
  const until = String(filters.until ?? '').trim();

  let rows = readLog().records.filter((r) => r && r.schemaVersion === 2);

  if (conversationId) rows = rows.filter((r) => r.conversationId === conversationId);
  if (kind) rows = rows.filter((r) => r.kind === kind);
  if (projectId) rows = rows.filter((r) => r.projectId === projectId);
  if (agentTaskId) rows = rows.filter((r) => r.agentTaskId === agentTaskId);
  if (backendTaskId) rows = rows.filter((r) => r.backendTaskId === backendTaskId);
  if (since) {
    const sinceMs = Date.parse(since);
    if (Number.isFinite(sinceMs)) {
      rows = rows.filter((r) => Date.parse(String(r.ts ?? '')) >= sinceMs);
    }
  }
  if (until) {
    const untilMs = Date.parse(until);
    if (Number.isFinite(untilMs)) {
      rows = rows.filter((r) => Date.parse(String(r.ts ?? '')) <= untilMs);
    }
  }

  return rows.slice(0, cap);
}

function clearConvaiRuntimeInvocations() {
  const { writeLog } = require('./persist');
  writeLog({ records: [] });
}

module.exports = {
  listConvaiRuntimeInvocations,
  clearConvaiRuntimeInvocations,
};
