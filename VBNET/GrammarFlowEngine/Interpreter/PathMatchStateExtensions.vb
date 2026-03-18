Option Strict On
Option Explicit On

Imports System.Runtime.CompilerServices
Imports GrammarFlowEngine.Compiler

''' <summary>
''' Extension methods for PathMatchState to improve code readability
''' </summary>
Public Module PathMatchStateExtensions

    ''' <summary>
    ''' Gets the current word at the position in the path state
    ''' </summary>
    <Extension()>
    Public Function GetCurrentWord(context As PathMatchState) As String
        Dim remainingText = context.Text.Substring(context.Position).Trim()
        If String.IsNullOrEmpty(remainingText) Then Return String.Empty

        Dim words = remainingText.Split({" "c, vbTab, vbCr, vbLf}, StringSplitOptions.RemoveEmptyEntries)
        If words.Length > 0 Then
            Return words(0)
        End If
        Return String.Empty
    End Function

    ''' <summary>
    ''' Checks if we're at the end of text in this path state
    ''' </summary>
    <Extension()>
    Public Function IsEndOfText(context As PathMatchState) As Boolean
        Dim remainingText = context.Text.Substring(context.Position).Trim()
        Return String.IsNullOrEmpty(remainingText)
    End Function

    ''' <summary>
    ''' Creates a new path state with the match applied (immutable update)
    ''' </summary>
    <Extension()>
    Public Function WithMatch(context As PathMatchState, match As MatchResult) As PathMatchState
        Dim newContext = context.Clone()
        newContext.Position += match.ConsumedChars
        newContext.GarbageUsed += match.GarbageUsed

        ' Merge bindings
        For Each kvp In match.Bindings
            newContext.Bindings(kvp.Key) = kvp.Value
        Next

        Return newContext
    End Function

End Module
