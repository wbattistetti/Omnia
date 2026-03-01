' PlaceholderUtils.vb
' Utility functions for placeholder substitution in messages.

Option Strict On
Option Explicit On
Imports System.Text.RegularExpressions
Imports TaskEngine

''' <summary>
''' Utility functions for processing placeholders in text messages.
''' </summary>
Public Module PlaceholderUtils
    ' Pre-compiled regex for placeholder substitution (e.g. [FullLabel.Path]).
    Private ReadOnly PlaceholderRegex As New Regex("\[([^\[\]]+)\]", RegexOptions.Compiled)

    ''' <summary>
    ''' Substitutes [FullLabel] placeholders in text with runtime values from the task tree.
    ''' Iterates until no more placeholders remain (supports chained substitutions).
    ''' Throws if a placeholder cannot be resolved.
    ''' </summary>
    Public Function ProcessPlaceholders(text As String, context As TaskUtterance,
                                        Optional globalContext As IVariableContext = Nothing) As String
        If String.IsNullOrEmpty(text) Then Return text

        If globalContext Is Nothing Then
            globalContext = New GlobalVariableContext(context)
        End If

        Dim result As String = text
        Dim iterations As Integer = 0
        Const MaxIterations As Integer = 10

        While result.Contains("[") AndAlso iterations < MaxIterations
            iterations += 1
            Dim matches As MatchCollection = PlaceholderRegex.Matches(result)
            If matches.Count = 0 Then Exit While

            For Each m As Match In matches
                Dim fullLabel = m.Groups(1).Value.Trim()
                Dim value = globalContext.GetValue(fullLabel)

                If String.IsNullOrEmpty(value) Then
                    Throw New InvalidOperationException($"Placeholder '[{fullLabel}]' could not be resolved in task '{context.Id}'. Check that the variable name matches a known FullLabel.")
                End If

                result = result.Replace(m.Value, value)
            Next
        End While

        Return result
    End Function
End Module
