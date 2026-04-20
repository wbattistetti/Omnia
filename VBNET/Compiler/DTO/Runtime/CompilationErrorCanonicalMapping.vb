Option Strict On
Option Explicit On

''' <summary>
''' Maps legacy compiler categories and infer-detail strings to canonical <see cref="CompilationErrorCode"/> JSON names (aligned with TS <c>CompileMessageKey</c>).
''' </summary>
Public Module CompilationErrorCanonicalMapping

    Private Function EnumJsonName(code As CompilationErrorCode) As String
        Return [Enum].GetName(GetType(CompilationErrorCode), code)
    End Function

    ''' <summary>
    ''' Maps detail strings produced during task compilation failure handling to canonical codes.
    ''' </summary>
    ''' <summary>Canonical JSON code name for an enum member (frontend <c>CompileMessageKey</c>).</summary>
    Public Function CanonicalCode(code As CompilationErrorCode) As String
        Return EnumJsonName(code)
    End Function

    Public Function CodeFromInferDetail(detail As String) As String
        Select Case If(detail, "").Trim()
            Case "TemplateNotFound"
                Return EnumJsonName(CompilationErrorCode.TemplateNotFound)
            Case "LeafContractMissing"
                Return EnumJsonName(CompilationErrorCode.ParserMissing)
            Case "InvalidContract"
                Return EnumJsonName(CompilationErrorCode.ContractInvalid)
            Case "JsonError"
                Return EnumJsonName(CompilationErrorCode.JsonStructureInvalid)
            Case Else
                Return EnumJsonName(CompilationErrorCode.TaskDataInvalid)
        End Select
    End Function

    ''' <summary>
    ''' Stable code from legacy <see cref="CompilationError.Category"/> (+ optional <see cref="CompilationError.Reason"/> for AmbiguousLink).
    ''' </summary>
    Public Function CodeFromLegacyCategory(category As String, Optional reason As String = Nothing) As String
        Dim c = If(category, "").Trim()
        Dim r = If(reason, "").Trim()
        Select Case c
            Case "NoEntryNodes"
                Return EnumJsonName(CompilationErrorCode.FlowNoEntry)
            Case "MultipleEntryNodes"
                Return EnumJsonName(CompilationErrorCode.FlowMultipleEntry)
            Case "MissingOrInvalidTask"
                Return EnumJsonName(CompilationErrorCode.FlowRowNoTask)
            Case "TaskTypeInvalidOrMissing"
                Return EnumJsonName(CompilationErrorCode.TaskTypeUndefined)
            Case "ConditionNotFound", "ConditionMissingScript", "LinkMissingCondition"
                Return EnumJsonName(CompilationErrorCode.LinkConditionMissing)
            Case "AmbiguousLink"
                Select Case r
                    Case "sameLabel"
                        Return EnumJsonName(CompilationErrorCode.LinkDuplicateLabel)
                    Case "sameCondition"
                        Return EnumJsonName(CompilationErrorCode.LinkDuplicateCondition)
                    Case "overlappingConditions"
                        Return EnumJsonName(CompilationErrorCode.LinkRulesIndistinguishable)
                    Case Else
                        Return EnumJsonName(CompilationErrorCode.LinkConditionMissing)
                End Select
            Case "EmptyEscalation"
                Return EnumJsonName(CompilationErrorCode.EscalationActionsMissing)
            Case "MissingDataContract"
                Return EnumJsonName(CompilationErrorCode.ParserMissing)
            Case "NlpContractInvalid"
                Return EnumJsonName(CompilationErrorCode.NlpContractInvalid)
            Case "EmptyInterpretationEngines"
                Return EnumJsonName(CompilationErrorCode.EmptyInterpretationEngines)
            Case "CanonicalGuidResolution"
                Return EnumJsonName(CompilationErrorCode.TaskInvalidReferences)
            Case Else
                Return ""
        End Select
    End Function

End Module
