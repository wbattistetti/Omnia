/**
 * Keys copied when persisting Backend Call task *instances* (templateId set).
 * Must stay aligned with `BACKEND_CALL_INSTANCE_FIELD_KEYS` in `backend/taskInstanceBulkSerialize.js`.
 */
export const BACKEND_CALL_INSTANCE_PERSIST_KEYS: readonly string[] = [
  // Legacy / compat
  'endpoint',
  'method',
  'params',
  'label',
  // Current editor model
  'openapiSpecUrl',
  'inputs',
  'outputs',
  'mockTable',
  'mockTableColumns',
  'mockTableDefaultExecutionMode',
  'inputAdvancement',
  'inputAdvancementTypes',
  'backendToolDescription',
  'endpointInvocationValues',
  'backendCallSpecMeta',
  'referenceScanInternalText',
];
