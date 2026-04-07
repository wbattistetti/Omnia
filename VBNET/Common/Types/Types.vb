Option Strict On
Option Explicit On
Imports System.Collections.Generic
Imports TaskEngine

''' <summary>
''' TurnEvent: Result of user input interpretation
''' </summary>
Public Enum TurnEvent
    Match
    NoMatch
    NoInput
    PartialMatch
    MatchOutOfContext
    MatchInContext
    MatchIrrelevant
    Confirmed
    NotConfirmed
    Unknown
End Enum

''' <summary>
''' TurnState: Current state of the dialogue
''' </summary>
Public Enum TurnState
    Start
    NoMatch
    NoInput
    Confirmation
    CollectingMain
    CollectingSub
    Success
    NotConfirmed
End Enum

''' <summary>
''' TurnStateDescriptor: Result of ComputeTurnState()
''' Describes the next TurnState based on TurnEvent
''' </summary>
Public Class TurnStateDescriptor
    ''' <summary>
    ''' Next TurnState to transition to
    ''' </summary>
    Public Property TurnState As TurnState

    ''' <summary>
    ''' Context: "CollectingMain" | "CollectingSub"
    ''' </summary>
    Public Property Context As String

    ''' <summary>
    ''' Escalation counter value
    ''' </summary>
    Public Property Counter As Integer

    ''' <summary>
    ''' Next data ID to collect (if CollectingSub)
    ''' </summary>
    Public Property NextDataId As String
End Class

''' <summary>
''' CurrentData: Current data node being collected
''' NOTE: Only stores NodeId, NOT full RuntimeTask (for serialization)
''' </summary>
Public Class CurrentData
    ''' <summary>
    ''' Node ID of the current data
    ''' </summary>
    Public Property NodeId As String

    ''' <summary>
    ''' True if collecting main data, False if collecting sub data
    ''' </summary>
    Public Property IsMain As Boolean

    ''' <summary>
    ''' Main data node ID (if IsMain = True)
    ''' </summary>
    Public Property MainDataId As String

    ''' <summary>
    ''' Sub data node ID (if IsMain = False)
    ''' </summary>
    Public Property SubDataId As String
End Class

''' <summary>
''' Response: Step/escalation to show
''' NOTE: Not serialized in DialogueContext (only used in memory)
''' </summary>
Public Class Response
    ''' <summary>
    ''' Step type: "start", "noMatch", "noInput", "confirmation", "success"
    ''' </summary>
    Public Property StepType As String

    ''' <summary>
    ''' Step or escalation to show
    ''' </summary>
    Public Property StepOrEscalation As CompiledDialogueStep

    ''' <summary>
    ''' Escalation level (0 = first escalation)
    ''' </summary>
    Public Property EscalationLevel As Integer
End Class

''' <summary>
''' ParseStatus: Status del parsing (diverso da ParseResultType per chiarezza)
''' </summary>
Public Enum ParseStatus
    Match
    NoMatch
    NoInput
    PartialMatch
    MatchedButInvalid
End Enum

''' <summary>
''' DialogueMode: Modalità corrente del dialogo (separazione chiara delle fasi)
''' </summary>
Public Enum DialogueMode
    ExecutingStep
    WaitingForUtterance
    Completed
End Enum

''' <summary>
''' DialogueState: Complete DDT dialogue state
''' NOTE: CurrentTask and RootTask are Object to avoid Common -> Compiler dependency.
''' Cast to CompiledUtteranceTask when used (Engine, Orchestrator, ApiServer all reference Compiler).
''' </summary>
Public Class DialogueState
    ''' <summary>
    ''' Valori per GUID slot (CanonicalGuidTable / Match.Guid). Nuovo modello utterance.
    ''' </summary>
    Public Property VariablesBySlotGuid As New Dictionary(Of String, Object)(StringComparer.OrdinalIgnoreCase)

    ''' <summary>
    ''' Counters: Escalation counters per node (nodeId -> Counters)
    ''' </summary>
    Public Property Counters As Dictionary(Of String, Counters)

    ''' <summary>
    ''' Current TurnState
    ''' </summary>
    Public Property TurnState As TurnState

    ''' <summary>
    ''' Context: "CollectingMain" | "CollectingSub"
    ''' </summary>
    Public Property Context As String

    ''' <summary>
    ''' Current data node ID being collected
    ''' </summary>
    Public Property CurrentDataId As String

    ''' <summary>
    ''' ✅ Current compiled task being processed
    ''' NOTE: Type is Object to avoid Common -> Compiler dependency.
    ''' Cast to CompiledUtteranceTask when used.
    ''' </summary>
    Public Property CurrentTask As Object

    ''' <summary>
    ''' ✅ Root task (main task) - necessario per trovare parent dei subtask
    ''' NOTE: Type is Object to avoid Common -> Compiler dependency.
    ''' Cast to CompiledUtteranceTask when used.
    ''' </summary>
    Public Property RootTask As Object

    ''' <summary>
    ''' ✅ NEW: Current step type
    ''' </summary>
    Public Property CurrentStepType As DialogueStepType

    ''' <summary>
    ''' ✅ NEW: Indicates if the dialogue is completed
    ''' </summary>
    Public Property IsCompleted As Boolean

    ''' <summary>
    ''' ✅ NEW: Current dialogue mode (separazione chiara delle fasi)
    ''' </summary>
    Public Property Mode As DialogueMode

    Public Sub New()
        Counters = New Dictionary(Of String, Counters)()
        TurnState = TurnState.Start
        Context = "CollectingMain"
        CurrentDataId = Nothing
        CurrentTask = Nothing
        RootTask = Nothing
        CurrentStepType = DialogueStepType.Start
        IsCompleted = False
        Mode = DialogueMode.ExecutingStep
    End Sub

    Public Sub SetVariable(slotGuid As String, value As Object)
        If String.IsNullOrEmpty(slotGuid) Then Throw New ArgumentException(NameOf(slotGuid))
        VariablesBySlotGuid(slotGuid) = value
    End Sub

    Public Function GetVariable(slotGuid As String) As Object
        Dim v As Object = Nothing
        VariablesBySlotGuid.TryGetValue(slotGuid, v)
        Return v
    End Function
End Class

''' <summary>
''' Counters: Escalation counters for a node
''' </summary>
Public Class Counters
    Public Property NoMatch As Integer
    Public Property NoInput As Integer
    Public Property NotConfirmed As Integer
    Public Property Confirmation As Integer

    Public Sub New()
        NoMatch = 0
        NoInput = 0
        NotConfirmed = 0
        Confirmation = 0
    End Sub
End Class

''' <summary>
''' Limits: Escalation limits
''' </summary>
Public Class Limits
    Public Property NoMatchMax As Integer
    Public Property NoInputMax As Integer
    Public Property NotConfirmedMax As Integer

    Public Sub New()
        NoMatchMax = 3
        NoInputMax = 3
        NotConfirmedMax = 2
    End Sub

    ''' <summary>
    ''' Default limits
    ''' </summary>
    Public Shared ReadOnly Property [Default] As Limits
        Get
            Return New Limits()
        End Get
    End Property
End Class
