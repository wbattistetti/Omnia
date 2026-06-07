/**
 * Log runtime invocazioni ConvAI → Express (schema V2).
 */

'use strict';

const { SCHEMA_VERSION, KIND } = require('./types');
const { appendConvaiRuntimeInvocation } = require('./append');
const {
  listConvaiRuntimeInvocations,
  clearConvaiRuntimeInvocations,
} = require('./query');
const { extractConversationId } = require('./extractConversationId');
const {
  recordConvaiRuntimeInvocation,
  buildDialogStepDraft,
  buildGatewayDraft,
} = require('./buildRecordFromHandler');
const { mountConvaiRuntimeInvocationRoutes } = require('./routes');
const { LOG_PATH } = require('./persist');

module.exports = {
  SCHEMA_VERSION,
  KIND,
  appendConvaiRuntimeInvocation,
  listConvaiRuntimeInvocations,
  clearConvaiRuntimeInvocations,
  extractConversationId,
  recordConvaiRuntimeInvocation,
  buildDialogStepDraft,
  buildGatewayDraft,
  mountConvaiRuntimeInvocationRoutes,
  LOG_PATH,
};
