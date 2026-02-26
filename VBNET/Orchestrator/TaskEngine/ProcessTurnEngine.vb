Option Strict On
Option Explicit On
Imports Compiler
Imports Newtonsoft.Json
Namespace TaskEngine

''' <summary>
''' ProcessTurn: Funzione pura stateless per processare un turno di dialogo
''' ⚠️ STUB TEMPORANEO: Questo file è uno stub per permettere la compilazione
''' La vera implementazione verrà fatta nella Fase 1
''' </summary>
Public Class ProcessTurnEngine

    ''' <summary>
    ''' Risultato di ProcessTurn
    ''' </summary>
    Public Class DialogueTurnResult
        Public Property Messages As List(Of String)
        Public Property NewState As DialogueState
        Public Property Status As String ' "waiting_for_input" | "completed"

        Public Sub New()
            Messages = New List(Of String)()
            NewState = New DialogueState()
            Status = "waiting_for_input"
        End Sub
    End Class

    ''' <summary>
    ''' ProcessTurn: Funzione pura stateless
    ''' ⚠️ STUB: Solleva eccezione per indicare che non è ancora implementato
    ''' </summary>
    Public Shared Function ProcessTurn(
        state As DialogueState,
        utterance As String,
        task As CompiledUtteranceTask,
        translations As Dictionary(Of String, String)
    ) As DialogueTurnResult

        ' ⚠️ STUB: Solleva eccezione per indicare che non è ancora implementato
        Throw New NotImplementedException("ProcessTurnEngine.ProcessTurn() non è ancora implementato. Questo è uno stub temporaneo per permettere la compilazione.")

    End Function

End Class

End Namespace
