/**
 * HTTP handler POST omnia_dialog_step — dialogo KB deterministico per Convai.
 */

'use strict';

const { appendInvocation } = require('./convaiWebhookInvocationLogService');
const { stripEmptyConvaiOptionalFieldsInPlace } = require('./convaiOptionalFieldSemantics');
const { loadKbDialogRuntime } = require('./omniaDialogStep/kbDialogRuntimeLoader');
const { executeDialogStep, bindingKeysCanonical } = require('./omniaDialogStep/dialogStepEngine');
const {
  loadDialogBinding,
  saveDialogBinding,
  clearDialogBinding,
} = require('./omniaDialogStep/dialogStepSessionStore');

function isRecord(x) {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function readConversationId(body, req) {
  const fromBody = typeof body.conversationId === 'string' ? body.conversationId.trim() : '';
  if (fromBody) return fromBody;
  const hdr =
    typeof req.headers['x-conversation-id'] === 'string'
      ? req.headers['x-conversation-id'].trim()
      : '';
  return hdr;
}

/**
 * @param {object} deps
 * @param {(projectId: string, taskId: string) => Promise<object|null>} deps.loadProjectTask
 */
function createOmniaDialogStepHandler(deps) {
  const { loadProjectTask } = deps;

  return async function handleOmniaDialogStep(req, res) {
    const started = Date.now();
    const projectId = String(req.params.projectId ?? req.body?.projectId ?? '').trim();
    const agentTaskId = String(req.params.agentTaskId ?? req.body?.agentTaskId ?? '').trim();

    let bodyObj = isRecord(req.body) ? { ...req.body } : {};
    if (!isRecord(req.body) && typeof req.body === 'string' && req.body.trim()) {
      try {
        bodyObj = JSON.parse(req.body);
      } catch {
        bodyObj = {};
      }
    }
    stripEmptyConvaiOptionalFieldsInPlace(bodyObj);

    const conversationId = readConversationId(bodyObj, req);
    const kbDocumentId =
      typeof bodyObj.kbDocumentId === 'string' ? bodyObj.kbDocumentId.trim() : '';
    const reset = bodyObj.reset === true;
    const updates = isRecord(bodyObj.updates) ? bodyObj.updates : isRecord(bodyObj.slots) ? bodyObj.slots : {};

    const logContext = {
      projectId,
      agentTaskId,
      conversationId,
      gatewayPath: req.originalUrl || req.url || '',
    };

    if (!projectId || !agentTaskId) {
      return res.status(400).json({ status: 'error', error: 'missing_project_or_agent_task' });
    }
    if (!conversationId) {
      return res.status(400).json({ status: 'error', error: 'missing_conversation_id' });
    }

    let agentTask;
    try {
      agentTask = await loadProjectTask(projectId, agentTaskId);
    } catch (err) {
      console.error('[omnia-dialog-step] load task', err);
      return res.status(500).json({ status: 'error', error: 'task_load_failed' });
    }
    if (!agentTask) {
      return res.status(404).json({ status: 'error', error: 'agent_task_not_found' });
    }

    const runtime = loadKbDialogRuntime(agentTask, kbDocumentId || undefined);
    if (runtime.error) {
      appendInvocation({
        ...logContext,
        durationMs: Date.now() - started,
        error: runtime.error,
      });
      return res.status(422).json({
        status: 'error',
        error: runtime.error,
        say: 'Configurazione knowledge base non pronta per il dialogo strutturato.',
      });
    }

    const scope = {
      projectId,
      agentTaskId,
      conversationId,
      kbDocumentId: runtime.documentId,
    };

    if (reset) {
      await clearDialogBinding(scope);
    }

    let binding = await loadDialogBinding(scope);
    const result = executeDialogStep({
      grid: runtime.grid,
      selectorSpec: runtime.selectorSpec,
      binding,
      updates,
    });

    const canonicalBinding = bindingKeysCanonical(result.binding ?? binding, runtime.grid.headers);
    await saveDialogBinding(scope, canonicalBinding);

    const response = {
      status: result.status,
      say: result.say,
      binding: canonicalBinding,
      kbDocumentId: runtime.documentId,
      kbDocumentName: runtime.documentName,
      remainingRowCount: result.remainingRowCount ?? 0,
      ...(result.nextColumnId ? { nextColumnId: result.nextColumnId } : {}),
      ...(result.nextHeaderLabel ? { nextHeaderLabel: result.nextHeaderLabel } : {}),
      ...(result.allowedValues ? { allowedValues: result.allowedValues } : {}),
      ...(result.matchedRow ? { matchedRow: result.matchedRow } : {}),
      ...(result.matchedRows ? { matchedRows: result.matchedRows } : {}),
      ...(result.rejected ? { rejected: result.rejected } : {}),
    };

    appendInvocation({
      ...logContext,
      kbDocumentId: runtime.documentId,
      requestBodyFromClient: bodyObj,
      upstreamStatus: 200,
      upstreamResponsePreview: JSON.stringify(response).slice(0, 4000),
      durationMs: Date.now() - started,
      error: result.status === 'error' ? 'dialog_step_error' : null,
    });

    return res.status(200).json(response);
  };
}

module.exports = {
  createOmniaDialogStepHandler,
};
