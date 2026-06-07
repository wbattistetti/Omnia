/**
 * Normalizzazione strict schema V2 per record invocazione runtime ConvAI.
 */

'use strict';

const crypto = require('crypto');
const { SCHEMA_VERSION, KIND, DIALOG_STATUS } = require('./types');
const { previewValue } = require('./persist');

/**
 * @param {unknown} v
 * @returns {string|null}
 */
function trimOrNull(v) {
  const s = String(v ?? '').trim();
  return s || null;
}

/**
 * @param {object} draft
 * @returns {object}
 */
function normalizeConvaiRuntimeInvocation(draft) {
  if (!draft || typeof draft !== 'object') {
    throw new Error('convaiRuntimeInvocation: draft obbligatorio');
  }

  const kind = trimOrNull(draft.kind);
  if (kind !== KIND.OMNIA_DIALOG_STEP && kind !== KIND.CONVAI_WEBHOOK_GATEWAY) {
    throw new Error(`convaiRuntimeInvocation: kind invalido (${kind})`);
  }

  const backendLabel = trimOrNull(draft.backendLabel);
  if (!backendLabel) {
    throw new Error('convaiRuntimeInvocation: backendLabel obbligatorio');
  }

  const httpStatus = Number(draft.httpStatus);
  if (!Number.isFinite(httpStatus) || httpStatus < 100 || httpStatus > 599) {
    throw new Error('convaiRuntimeInvocation: httpStatus obbligatorio (100-599)');
  }

  const error = trimOrNull(draft.error);
  let conversationId = trimOrNull(draft.conversationId);
  const allowNullConversationId = new Set([
    'missing_conversation_id',
    'missing_path_params',
    'missing_project_or_agent_task',
    'task_load_failed',
    'agent_task_not_found',
    'backend_task_not_found',
    'backend_missing_endpoint_url',
  ]);
  if (!conversationId && (!error || !allowNullConversationId.has(error))) {
    throw new Error('convaiRuntimeInvocation: conversationId obbligatorio');
  }

  let dialogStatus = draft.dialogStatus === null ? null : trimOrNull(draft.dialogStatus);
  if (kind === KIND.OMNIA_DIALOG_STEP) {
    if (dialogStatus && !DIALOG_STATUS.has(dialogStatus)) {
      throw new Error(`convaiRuntimeInvocation: dialogStatus invalido (${dialogStatus})`);
    }
    if (
      httpStatus >= 200 &&
      httpStatus < 300 &&
      !dialogStatus &&
      !error
    ) {
      throw new Error('convaiRuntimeInvocation: dialogStatus obbligatorio su success omnia_dialog_step');
    }
  } else {
    dialogStatus = null;
  }

  const requestBodyFromClient =
    draft.requestBodyFromClient === undefined
      ? null
      : previewValue(draft.requestBodyFromClient);
  const upstreamResponsePreview =
    draft.upstreamResponsePreview === undefined
      ? null
      : previewValue(draft.upstreamResponsePreview);

  const durationMs = Number.isFinite(draft.durationMs) ? Math.max(0, draft.durationMs) : 0;

  const upstreamHttpStatus = Number.isFinite(draft.upstreamHttpStatus)
    ? draft.upstreamHttpStatus
    : null;

  return {
    schemaVersion: SCHEMA_VERSION,
    id: trimOrNull(draft.id) || crypto.randomUUID(),
    ts: trimOrNull(draft.ts) || new Date().toISOString(),
    kind,
    backendLabel,
    conversationId,
    projectId: trimOrNull(draft.projectId),
    agentTaskId: trimOrNull(draft.agentTaskId),
    backendTaskId: kind === KIND.CONVAI_WEBHOOK_GATEWAY ? trimOrNull(draft.backendTaskId) : null,
    gatewayPath: trimOrNull(draft.gatewayPath),
    upstreamUrl: kind === KIND.CONVAI_WEBHOOK_GATEWAY ? trimOrNull(draft.upstreamUrl) : null,
    forwardMethod:
      kind === KIND.CONVAI_WEBHOOK_GATEWAY
        ? String(draft.forwardMethod ?? 'POST').trim().toUpperCase() || 'POST'
        : null,
    httpStatus,
    dialogStatus: dialogStatus ?? null,
    requestBodyFromClient,
    requestBodyAfterSendHints:
      kind === KIND.CONVAI_WEBHOOK_GATEWAY
        ? previewValue(draft.requestBodyAfterSendHints)
        : null,
    upstreamResponsePreview,
    upstreamHttpStatus,
    durationMs,
    sendHintsApplied:
      kind === KIND.CONVAI_WEBHOOK_GATEWAY && Number.isFinite(draft.sendHintsApplied)
        ? draft.sendHintsApplied
        : null,
    error,
  };
}

module.exports = { normalizeConvaiRuntimeInvocation };
