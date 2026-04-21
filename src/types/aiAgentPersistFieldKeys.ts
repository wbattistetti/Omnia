/**
 * AI Agent persisted field names (design-time + agent payload).
 * Must stay aligned with `AI_AGENT_INSTANCE_FIELD_KEYS` in `backend/server.js`.
 * TaskRepository / tasks/bulk is the source of truth for these at project save;
 * DialogueTaskService template cache must not overwrite them via POST /templates.
 */
export const AI_AGENT_PERSIST_FIELD_KEYS: readonly string[] = [
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
  'agentPromptTargetPlatform',
  'agentIaRuntimeOverrideJson',
];
