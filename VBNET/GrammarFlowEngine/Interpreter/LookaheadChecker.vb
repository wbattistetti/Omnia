Option Strict On
Option Explicit On

Imports System.Linq
Imports GrammarFlowEngine.Compiler

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

            ' Create a temporary path state for lookahead
            Dim tempContext As New PathMatchState() With {
                .Text = text,
                .Position = position,
                .GarbageUsed = 0,
                .MaxGarbage = 0 ' No garbage for lookahead
            }

            ' Quick check: verify if at least ONE child can potentially match
            For Each child In children
                ' Quick check: verify only label/synonyms (fast)
                Dim currentWord = tempContext.GetCurrentWord()
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


    End Module

