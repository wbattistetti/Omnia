Option Strict On
Option Explicit On

Imports Newtonsoft.Json

Namespace ElevenLabs

''' <summary>
''' POST /elevenlabs/startAgent request body.
''' </summary>
Public Class ElevenLabsStartAgentRequest
    <JsonProperty("agentId")>
    Public Property AgentId As String

    <JsonProperty("dynamicVariables")>
    Public Property DynamicVariables As Dictionary(Of String, Object)
End Class

''' <summary>
''' POST /elevenlabs/sendUserTurn request body.
''' </summary>
Public Class ElevenLabsSendUserTurnRequest
    <JsonProperty("conversationId")>
    Public Property ConversationId As String

    <JsonProperty("text")>
    Public Property Text As String
End Class

''' <summary>
''' POST /elevenlabs/agentTurn — payload from ElevenLabs server tool (adjust fields to match agent configuration).
''' </summary>
Public Class ElevenLabsAgentTurnWebhookRequest
    <JsonProperty("conversationId")>
    Public Property ConversationId As String

    <JsonProperty("text")>
    Public Property Text As String

    ''' <summary>When true, marks conversation completed after this turn.</summary>
    <JsonProperty("isFinal")>
    Public Property IsFinal As Boolean?

    <JsonProperty("status")>
    Public Property Status As String
End Class

''' <summary>
''' POST /elevenlabs/endConversation request body.
''' </summary>
Public Class ElevenLabsEndConversationRequest
    <JsonProperty("conversationId")>
    Public Property ConversationId As String
End Class

''' <summary>One agent-visible turn delivered to the engine.</summary>
Public Class ElevenLabsAgentTurnPayload
    Public Property Text As String
    ''' <summary><c>running</c> or <c>completed</c>.</summary>
    Public Property Status As String
End Class

End Namespace
