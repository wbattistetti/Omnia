Option Strict On
Option Explicit On

Imports System.Linq
Imports GrammarInterpreter.Compiler

Namespace GrammarInterpreter.Interpreter

    ''' <summary>
    ''' Quick lookahead check to avoid unnecessary backtracking
    ''' </summary>
    Public Module LookaheadChecker

        ''' <summary>
        ''' Checks if any child node can potentially match at the given position
        ''' Returns False if at least one child can match, True if none can match
        ''' </summary>
        Public Function LookaheadFails(children As List(Of CompiledNode), position As Integer, text As String, compiledGrammar As CompiledGrammar) As Boolean
            If children Is Nothing OrElse children.Count = 0 Then
                Return True ' No children = fail
            End If

            ' Create a temporary context for lookahead
            Dim tempContext As New MatchContext() With {
                .Text = text,
                .Position = position,
                .GarbageUsed = 0,
                .MaxGarbage = 0 ' No garbage for lookahead
            }

            ' Quick check: verify if at least ONE child can potentially match
            For Each child In children
                ' Quick check: verify only label/synonyms (fast)
                Dim currentWord = GetCurrentWord(tempContext)
                If Not String.IsNullOrEmpty(currentWord) Then
                    ' Check if current word matches label or synonyms
                    If child.AllWords.Contains(currentWord) Then
                        Return False ' At least one child can match
                    End If

                    ' Check if child has regex (quick check)
                    If child.CompiledRegex IsNot Nothing Then
                        Dim remainingText = text.Substring(position).Trim()
                        If child.CompiledRegex.IsMatch(remainingText) Then
                            Return False ' Regex can potentially match
                        End If
                    End If
                End If
            Next

            Return True ' No child can match
        End Function

        ''' <summary>
        ''' Gets the current word at position
        ''' </summary>
        Private Function GetCurrentWord(context As MatchContext) As String
            Dim remainingText = context.Text.Substring(context.Position).Trim()
            If String.IsNullOrEmpty(remainingText) Then Return String.Empty

            Dim words = remainingText.Split({" "c, vbTab, vbCr, vbLf}, StringSplitOptions.RemoveEmptyEntries)
            If words.Length > 0 Then
                Return words(0)
            End If
            Return String.Empty
        End Function

    End Module

End Namespace
