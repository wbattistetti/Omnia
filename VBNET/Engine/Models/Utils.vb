' Utils.vb
' Shared utility functions for the dialogue engine.

Option Strict On
Option Explicit On
Imports System.Runtime.CompilerServices

Module Utils
    ' PlaceholderRegex removed - now using Common.PlaceholderUtils

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
    ''' Uses Common.PlaceholderUtils.ProcessPlaceholders (delegates to avoid duplication).
    ''' </summary>
    Public Function ProcessPlaceholders(text As String, context As TaskUtterance,
                                        Optional globalContext As IVariableContext = Nothing) As String
        Return PlaceholderUtils.ProcessPlaceholders(text, context, globalContext)
    End Function


End Module
