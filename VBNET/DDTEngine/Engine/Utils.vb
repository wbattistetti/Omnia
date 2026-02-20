' Utils.vb
' Shared utility functions for the dialogue engine.

Option Strict On
Option Explicit On
Imports System.Runtime.CompilerServices
Imports System.Text.RegularExpressions

Module Utils
    ' Pre-compiled regex for placeholder substitution (e.g. [FullLabel.Path]).
    Private ReadOnly PlaceholderRegex As New Regex("\[([^\[\]]+)\]", RegexOptions.Compiled)

    ''' <summary>Returns True when the task has no value (leaf) or no sub-task has a value (composite).</summary>
    <Extension>
    Public Function IsEmpty(task As TaskUtterance) As Boolean
        If task.SubTasks.Any() Then Return Not task.SubTasks.Any(Function(st) st.Value IsNot Nothing)
        Return task.Value Is Nothing
    End Function

    ''' <summary>Returns True when all sub-tasks have values (composite) or this leaf has a value.</summary>
    <Extension>
    Public Function IsFilled(task As TaskUtterance) As Boolean
        If task.SubTasks.Any() Then Return Not task.SubTasks.Any(Function(st) st.Value Is Nothing)
        Return task.Value IsNot Nothing
    End Function

    ''' <summary>Returns True when this task is a sub-task (has a parent).</summary>
    <Extension>
    Public Function IsSubData(task As TaskUtterance) As Boolean
        Return task.ParentData IsNot Nothing
    End Function

    ''' <summary>Returns True when any task in the list is a session-terminating task.</summary>
    <Extension>
    Public Function HasExitCondition(tasks As IEnumerable(Of ITask)) As Boolean
        Return tasks.Any(Function(t) TypeOf t Is CloseSessionTask OrElse TypeOf t Is TransferTask)
    End Function

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
