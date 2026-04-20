/**
 * Canonical compile error codes: must stay aligned with VB `CompilationErrorCode` enum names (JSON string).
 */

export type CompileMessageKey =
  | 'EscalationActionsMissing'
  | 'EscalationTerminationMissing'
  | 'ParserMissing'
  | 'TemplateNotFound'
  | 'ContractInvalid'
  | 'JsonStructureInvalid'
  | 'ContractIncomplete'
  | 'TaskDataInvalid'
  | 'FlowRowNoTask'
  | 'TaskTypeUndefined'
  | 'FlowNoEntry'
  | 'FlowMultipleEntry'
  | 'LinkConditionMissing'
  | 'LinkDuplicateLabel'
  | 'LinkDuplicateCondition'
  | 'LinkRulesIndistinguishable'
  | 'LinksNotMutuallyExclusive'
  | 'LinkDuplicateConditionScript'
  | 'EscalationMessageMissing'
  | 'EscalationNoTermination'
  | 'ResponseMessageMissing'
  | 'VariableNameMissing'
  | 'VariableDuplicate'
  | 'TranslationOwnerMissing'
  | 'TranslationDefaultMissing'
  | 'TaskInvalidReferences'
  | 'TaskRefNotFound'
  | 'NodeRefNotFound'
  | 'NlpContractInvalid'
  | 'EmptyInterpretationEngines'
  | 'CanonicalGuidResolution'
  | 'TaskNotCompilableGeneric'
  | 'EmptyValueNotAllowed'
  | 'LegacyUnknown'
  | 'SubflowChildNotRunnable';

/** Set of keys accepted from backend `code` field. */
export const KNOWN_COMPILE_MESSAGE_KEYS: ReadonlySet<string> = new Set<CompileMessageKey>([
  'EscalationActionsMissing',
  'EscalationTerminationMissing',
  'ParserMissing',
  'TemplateNotFound',
  'ContractInvalid',
  'JsonStructureInvalid',
  'ContractIncomplete',
  'TaskDataInvalid',
  'FlowRowNoTask',
  'TaskTypeUndefined',
  'FlowNoEntry',
  'FlowMultipleEntry',
  'LinkConditionMissing',
  'LinkDuplicateLabel',
  'LinkDuplicateCondition',
  'LinkRulesIndistinguishable',
  'LinksNotMutuallyExclusive',
  'LinkDuplicateConditionScript',
  'EscalationMessageMissing',
  'EscalationNoTermination',
  'ResponseMessageMissing',
  'VariableNameMissing',
  'VariableDuplicate',
  'TranslationOwnerMissing',
  'TranslationDefaultMissing',
  'TaskInvalidReferences',
  'TaskRefNotFound',
  'NodeRefNotFound',
  'NlpContractInvalid',
  'EmptyInterpretationEngines',
  'CanonicalGuidResolution',
  'TaskNotCompilableGeneric',
  'EmptyValueNotAllowed',
  'LegacyUnknown',
  'SubflowChildNotRunnable',
]);
