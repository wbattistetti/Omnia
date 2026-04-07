Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports System.Text.RegularExpressions
Imports Compiler

''' <summary>
''' Demo: ultima parola; slot = GUID canonico principale del task.
''' </summary>
Public NotInheritable Class LastWordUtteranceEngine
    Implements IInterpretationEngine

    Private ReadOnly _displayName As String
    Private ReadOnly _task As CompiledUtteranceTask

    Public Sub New(displayName As String, task As CompiledUtteranceTask)
        _displayName = displayName
        _task = task
    End Sub

    Public ReadOnly Property DisplayName As String Implements IInterpretationEngine.DisplayName
        Get
            Return _displayName
        End Get
    End Property

    Public Function Parse(utterance As String) As EngineResult Implements IInterpretationEngine.Parse
        If String.IsNullOrWhiteSpace(utterance) Then
            Return EngineResult.NoMatch(If(utterance, String.Empty).Trim())
        End If

        Dim t = utterance.Trim()
        Dim m = Regex.Match(t, "(\S+)\s*$")
        If Not m.Success Then
            Return EngineResult.NoMatch(t)
        End If

        Dim word = m.Groups(1).Value
        Dim slotGuid = _task.GetPrimarySlotCanonicalGuid()
        Dim matches As New List(Of ParserMatch) From {
                New ParserMatch With {.Guid = slotGuid, .Value = word, .Linguistic = word}
            }
        Return EngineResultFactory.FromMatches(matches, t, word)
    End Function

End Class
