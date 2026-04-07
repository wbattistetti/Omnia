Option Strict On
Option Explicit On

Imports Compiler

''' <summary>
''' Entry point: escalation su <see cref="CompiledUtteranceTask.Engines"/> → primo match NLP → <see cref="ParseResult"/> per il dialogo.
''' </summary>
Public Module UtteranceInterpretationParse

    ''' <summary>
    ''' Interpreta l'utterance usando i motori registrati sul task (ordine = escalation).
    ''' </summary>
    Public Function Parse(utterance As String, task As CompiledUtteranceTask) As ParseResult
        If String.IsNullOrWhiteSpace(utterance) Then
            Return ParseResult.NoMatch()
        End If

        If task Is Nothing Then Throw New ArgumentNullException(NameOf(task))
        If task.Engines Is Nothing OrElse task.Engines.Count = 0 Then
            Throw New InvalidOperationException("CompiledUtteranceTask.Engines must be populated.")
        End If

        Dim orch As New UtteranceInterpretationOrchestrator(consumeMatched:=True)
        Return orch.ParseSingleTask(utterance.Trim(), task, task.Engines)
    End Function

End Module
