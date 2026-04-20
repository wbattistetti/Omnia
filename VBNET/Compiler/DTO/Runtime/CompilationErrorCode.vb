Option Strict On
Option Explicit On

''' <summary>
''' Canonical compile error codes (JSON string names must match frontend <c>CompileMessageKey</c>).
''' Extend only together with TS union and compile message tables.
''' </summary>
Public Enum CompilationErrorCode
    ParserMissing
    TemplateNotFound
    ContractInvalid
    JsonStructureInvalid
    ContractIncomplete
    TaskDataInvalid
    FlowRowNoTask
    TaskTypeUndefined
    FlowNoEntry
    FlowMultipleEntry
    LinkConditionMissing
    LinkDuplicateLabel
    LinkDuplicateCondition
    LinkRulesIndistinguishable
    LinksNotMutuallyExclusive
    LinkDuplicateConditionScript
    EscalationMessageMissing
    EscalationNoTermination
    ResponseMessageMissing
    VariableNameMissing
    VariableDuplicate
    TranslationOwnerMissing
    TranslationDefaultMissing
    TaskInvalidReferences
    TaskRefNotFound
    NodeRefNotFound
    NlpContractInvalid
    EmptyInterpretationEngines
    CanonicalGuidResolution
    TaskNotCompilableGeneric
    EmptyValueNotAllowed
    ''' <summary>Escalation slot exists but contains no designer actions (tasks).</summary>
    EscalationActionsMissing
    ''' <summary>Escalation missing termination condition when required by model.</summary>
    EscalationTerminationMissing
    ''' <summary>Referenced child canvas is missing, has no nodes, or no rows (TS workspace guard + designer).</summary>
    SubflowChildNotRunnable
End Enum
