/**
 * Factory draft record V2 per handler gateway e omnia_dialog_step.
 */

'use strict';

const { KIND } = require('./types');
const { extractDialogStatus } = require('./extractDialogStatus');
const { appendConvaiRuntimeInvocation } = require('./append');

/**
 * @param {object} draft
 * @returns {object|null}
 */
function recordConvaiRuntimeInvocation(draft) {
  return appendConvaiRuntimeInvocation(draft);
}

/**
 * @param {object} params
 */
function buildDialogStepDraft(params) {
  const {
    projectId,
    agentTaskId,
    conversationId,
    gatewayPath,
    httpStatus,
    requestBodyFromClient,
    responseBody,
    durationMs,
    error,
  } = params;

  const dialogStatus =
    responseBody && typeof responseBody === 'object'
      ? extractDialogStatus(responseBody)
      : null;

  return {
    kind: KIND.OMNIA_DIALOG_STEP,
    backendLabel: 'omnia_dialog_step',
    conversationId: conversationId || null,
    projectId,
    agentTaskId,
    gatewayPath,
    httpStatus,
    dialogStatus,
    requestBodyFromClient,
    upstreamResponsePreview: responseBody,
    durationMs,
    error: error || null,
  };
}

/**
 * @param {object} params
 */
function buildGatewayDraft(params) {
  const {
    projectId,
    agentTaskId,
    backendTaskId,
    backendLabel,
    conversationId,
    gatewayPath,
    upstreamUrl,
    forwardMethod,
    httpStatus,
    requestBodyFromClient,
    requestBodyAfterSendHints,
    upstreamResponsePreview,
    upstreamHttpStatus,
    durationMs,
    sendHintsApplied,
    error,
  } = params;

  return {
    kind: KIND.CONVAI_WEBHOOK_GATEWAY,
    backendLabel: backendLabel || backendTaskId || 'backend',
    conversationId: conversationId || null,
    projectId,
    agentTaskId,
    backendTaskId,
    gatewayPath,
    upstreamUrl,
    forwardMethod,
    httpStatus,
    dialogStatus: null,
    requestBodyFromClient,
    requestBodyAfterSendHints,
    upstreamResponsePreview,
    upstreamHttpStatus,
    durationMs,
    sendHintsApplied,
    error: error || null,
  };
}

module.exports = {
  recordConvaiRuntimeInvocation,
  buildDialogStepDraft,
  buildGatewayDraft,
};
