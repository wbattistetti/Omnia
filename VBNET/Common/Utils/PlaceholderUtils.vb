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

        Return ProcessPlaceholdersWithResolver(
            text,
            Function(token As String) globalContext.GetValue(token),
            $"task '{context.Id}'"
        )
    End Function

    ''' <summary>
    ''' Substitutes [token] placeholders in text using a caller-provided resolver.
    ''' Iterates until no more placeholders remain (supports chained substitutions).
    ''' Unresolved placeholders are left as-is (no exception is thrown).
    ''' </summary>
    Public Function ProcessPlaceholdersWithResolver(
        text As String,
        resolveValue As Func(Of String, String),
        Optional contextLabel As String = "runtime context"
    ) As String
        If String.IsNullOrEmpty(text) Then Return text
        If resolveValue Is Nothing Then
            Throw New ArgumentNullException(NameOf(resolveValue), "resolveValue delegate cannot be Nothing.")
        End If

        Dim result As String = text
        Dim iterations As Integer = 0
        Const MaxIterations As Integer = 10

        While iterations < MaxIterations
            iterations += 1
            Dim matches As MatchCollection = PlaceholderRegex.Matches(result)
            If matches.Count = 0 Then Exit While

            Dim anyResolved As Boolean = False
            For Each m As Match In matches
                Dim token = m.Groups(1).Value.Trim()
                Dim value = resolveValue(token)
                If Not String.IsNullOrEmpty(value) Then
                    result = result.Replace(m.Value, value)
                    anyResolved = True
                End If
            Next

            ' No progress this iteration — stop to avoid infinite loop
            If Not anyResolved Then Exit While
        End While

        Return result
    End Function
End Module
