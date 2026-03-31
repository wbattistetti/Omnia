/**
 * Centralized serialization for task *instances* (templateId !== null) on project bulk/upsert.
 * The MongoDB $set payload must include type-specific fields (e.g. SayMessage.parameters for
 * translation GUID), not only shared instance fields (steps, semanticValues).
 *
 * Aligned with src/types/taskTypes.ts TaskType enum.
 */

/** @enum {number} Same numeric values as TaskType in taskTypes.ts */
const TaskType = {
  UNDEFINED: -1,
  SayMessage: 0,
  CloseSession: 1,
  Transfer: 2,
  UtteranceInterpretation: 3,
  BackendCall: 4,
  ClassifyProblem: 5,
  AIAgent: 6,
  Subflow: 7,
  Summarizer: 8,
  Negotiation: 9,
};

/** @see TaskType.AIAgent — design-time + persisted runtime fields */
const AI_AGENT_INSTANCE_FIELD_KEYS = [
  'agentDesignDescription',
  'agentPrompt',
  'agentStructuredSectionsJson',
  'outputVariableMappings',
  'agentProposedFields',
  'agentSampleDialogue',
  'agentPreviewByStyle',
  'agentPreviewStyleId',
  'agentInitialStateTemplateJson',
  'agentRuntimeCompactJson',
  'agentDesignFrozen',
  'agentDesignHasGeneration',
  'agentLogicalStepsJson',
  'agentUseCasesJson',
];

/**
 * Extra keys to copy from the client payload when present, beyond the shared instance core.
 * Keys not listed here are NOT persisted for instances (by design — avoid silent junk).
 */
const INSTANCE_TYPED_FIELD_KEYS = {
  [TaskType.SayMessage]: ['parameters', 'label'],
  [TaskType.CloseSession]: ['parameters', 'label'],
  [TaskType.Transfer]: ['parameters', 'label'],
  [TaskType.UtteranceInterpretation]: [],
  [TaskType.BackendCall]: ['endpoint', 'method', 'params', 'label'],
  [TaskType.ClassifyProblem]: ['label'],
  [TaskType.Subflow]: ['params', 'label'],
  [TaskType.Summarizer]: ['label'],
  [TaskType.Negotiation]: ['label'],
};

function pickAiAgentInstanceFields(item) {
  const out = {};
  for (const key of AI_AGENT_INSTANCE_FIELD_KEYS) {
    if (Object.prototype.hasOwnProperty.call(item, key)) {
      out[key] = item[key];
    }
  }
  return out;
}

/**
 * Copy listed keys from source when the property exists (allows null).
 * @param {Record<string, unknown>} source
 * @param {string[]} keys
 */
function pickPresentKeys(source, keys) {
  const out = {};
  if (!keys || !source) return out;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      out[key] = source[key];
    }
  }
  return out;
}

/**
 * @param {number} type
 * @returns {string[]}
 */
function getTypedFieldKeysForTaskType(type) {
  const keys = INSTANCE_TYPED_FIELD_KEYS[type];
  return Array.isArray(keys) ? keys : [];
}

/**
 * Builds the MongoDB $set document for a task instance (references a template via templateId).
 *
 * @param {Record<string, unknown>} item - Task row from client / TaskRepository
 * @param {{ projectId: string, now: Date }} ctx
 * @returns {Record<string, unknown>}
 */
function buildInstanceTaskDocument(item, { projectId, now }) {
  const type = item.type;

  const doc = {
    projectId,
    id: item.id,
    type,
    templateId: item.templateId,
    templateVersion: item.templateVersion || 1,
    labelKey: item.labelKey,
    steps: item.steps,
    semanticValues: item.semanticValues,
    updatedAt: now,
  };

  Object.assign(doc, pickPresentKeys(item, getTypedFieldKeysForTaskType(type)));

  if (type === TaskType.AIAgent) {
    Object.assign(doc, pickAiAgentInstanceFields(item));
  }

  return doc;
}

/**
 * Keys allowed when merging a partial task update for an instance (Tasks.put filter).
 * Must stay in sync with {@link buildInstanceTaskDocument}.
 * @param {number} type
 * @returns {string[]}
 */
function getAllowedInstanceFieldKeysForTaskType(type) {
  const base = [
    'type',
    'templateId',
    'templateVersion',
    'labelKey',
    'steps',
    'semanticValues',
    'updatedAt',
  ];
  const typed = getTypedFieldKeysForTaskType(type);
  let combined = [...base, ...typed];
  if (type === TaskType.AIAgent) {
    combined = [...combined, ...AI_AGENT_INSTANCE_FIELD_KEYS];
  }
  return [...new Set(combined)];
}

module.exports = {
  TaskType,
  buildInstanceTaskDocument,
  getAllowedInstanceFieldKeysForTaskType,
  pickAiAgentInstanceFields,
  AI_AGENT_INSTANCE_FIELD_KEYS,
};
