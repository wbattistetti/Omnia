/**
 * HTTP handler POST omnia_dialog_step — dialogo KB deterministico per Convai.
 */

'use strict';

const {
  extractConversationId,
  recordConvaiRuntimeInvocation,
  buildDialogStepDraft,
} = require('./convaiRuntimeInvocationLog');
const { stripEmptyConvaiOptionalFieldsInPlace } = require('./convaiOptionalFieldSemantics');
const { loadKbDialogRuntime } = require('./omniaDialogStep/kbDialogRuntimeLoader');
const { executeDialogStep, bindingKeysCanonical } = require('./omniaDialogStep/dialogStepEngine');
const { parseKbDialogRuntimeIndex } = require('./omniaDialogStep/kbDialogIndexLoader');
const {
  loadDialogSession,
  saveDialogSession,
  clearDialogBinding,
} = require('./omniaDialogStep/dialogStepSessionStore');

function isRecord(x) {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
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
    const gatewayPath = req.originalUrl || req.url || '';

    let bodyObj = isRecord(req.body) ? { ...req.body } : {};
    if (!isRecord(req.body) && typeof req.body === 'string' && req.body.trim()) {
      try {
        bodyObj = JSON.parse(req.body);
      } catch {
        bodyObj = {};
      }
    }
    stripEmptyConvaiOptionalFieldsInPlace(bodyObj);

    const conversationId = extractConversationId(bodyObj, req);
    const kbDocumentId =
      typeof bodyObj.kbDocumentId === 'string' ? bodyObj.kbDocumentId.trim() : '';
    const reset = bodyObj.reset === true;
    const updates = isRecord(bodyObj.updates) ? bodyObj.updates : isRecord(bodyObj.slots) ? bodyObj.slots : {};

    const logBase = {
      projectId: projectId || null,
      agentTaskId: agentTaskId || null,
      conversationId: conversationId || null,
      gatewayPath,
      requestBodyFromClient: bodyObj,
      durationMs: 0,
    };

    const respond = (httpStatus, responseBody, error) => {
      recordConvaiRuntimeInvocation(
        buildDialogStepDraft({
          ...logBase,
          httpStatus,
          responseBody,
          durationMs: Date.now() - started,
          error: error || null,
        })
      );
      return res.status(httpStatus).json(responseBody);
    };

    if (!projectId || !agentTaskId) {
      return respond(
        400,
        { status: 'error', error: 'missing_project_or_agent_task' },
        'missing_project_or_agent_task'
      );
    }
    if (!conversationId) {
      return respond(
        400,
        { status: 'error', error: 'missing_conversation_id' },
        'missing_conversation_id'
      );
    }

    let agentTask;
    try {
      agentTask = await loadProjectTask(projectId, agentTaskId);
    } catch (err) {
      console.error('[omnia-dialog-step] load task', err);
      return respond(500, { status: 'error', error: 'task_load_failed' }, 'task_load_failed');
    }
    if (!agentTask) {
      return respond(404, { status: 'error', error: 'agent_task_not_found' }, 'agent_task_not_found');
    }

    const runtime = loadKbDialogRuntime(agentTask, kbDocumentId || undefined);
    if (runtime.error) {
      return respond(
        422,
        {
          status: 'error',
          error: runtime.error,
          say: 'Configurazione knowledge base non pronta per il dialogo strutturato.',
        },
        runtime.error
      );
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

    const session = await loadDialogSession(scope);
    let binding = session.binding;
    const dialogIndex =
      parseKbDialogRuntimeIndex(agentTask.agentKbDialogIndexJson) ||
      (runtime.completeTemplate || Object.keys(runtime.valueLabels || {}).length
        ? {
            schemaVersion: 1,
            completeTemplate: runtime.completeTemplate || '',
            valueLabels: runtime.valueLabels || {},
            acquisition: {},
            inform: {},
            correction: [],
            complete: {
              useCaseId: 'uc_complete',
              sayTemplate: runtime.completeTemplate || '',
            },
          }
        : null);

    const result = executeDialogStep({
      grid: runtime.grid,
      selectorSpec: runtime.selectorSpec,
      binding,
      updates,
      dialogIndex,
      informState: session.informState,
    });

    const canonicalBinding = bindingKeysCanonical(result.binding ?? binding, runtime.grid.headers);
    await saveDialogSession(scope, canonicalBinding, result.informState);

    const response = {
      status: result.status,
      say: result.say,
      binding: canonicalBinding,
      kbDocumentId: runtime.documentId,
      kbDocumentName: runtime.documentName,
      remainingRowCount: result.remainingRowCount ?? 0,
      ...(result.useCaseId ? { useCaseId: result.useCaseId } : {}),
      ...(result.useCaseKind ? { useCaseKind: result.useCaseKind } : {}),
      ...(result.sayCore ? { sayCore: result.sayCore } : {}),
      ...(result.nextColumnId ? { nextColumnId: result.nextColumnId } : {}),
      ...(result.nextHeaderLabel ? { nextHeaderLabel: result.nextHeaderLabel } : {}),
      ...(result.allowedValues ? { allowedValues: result.allowedValues } : {}),
      ...(result.matchedRow ? { matchedRow: result.matchedRow } : {}),
      ...(result.matchedRows ? { matchedRows: result.matchedRows } : {}),
      ...(result.rejected ? { rejected: result.rejected } : {}),
      ...(result.requiresAcceptance === true ? { requiresAcceptance: true } : {}),
      ...(result.informColumnId ? { informColumnId: result.informColumnId } : {}),
      ...(result.conversationAction ? { conversationAction: result.conversationAction } : {}),
    };

    return respond(
      200,
      response,
      result.status === 'error' ? 'dialog_step_error' : null
    );
  };
}

module.exports = {
  createOmniaDialogStepHandler,
};

