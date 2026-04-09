Option Strict On
Option Explicit On

Imports Newtonsoft.Json

''' <summary>
''' G2: mandatory mapping grammarSlot.id → flow variable id (task/subDataMapping key).
''' </summary>
Public Class GrammarSlotBinding
    <JsonProperty("grammarSlotId")>
    Public Property GrammarSlotId As String

    <JsonProperty("flowVariableId")>
    Public Property FlowVariableId As String
End Class
