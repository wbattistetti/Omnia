' GlobalVariableContext.vb
' Resolves placeholder variables from the TaskUtterance tree.

Option Strict On
Option Explicit On

''' <summary>
''' Looks up variable values from a TaskUtterance tree using FullLabel as the key.
''' Searches the root context first, then any additional contexts.
''' </summary>
Public Class GlobalVariableContext
    Implements IVariableContext

    Private ReadOnly _root As TaskUtterance
    Private ReadOnly _extras As List(Of IVariableContext)

    Public Sub New(Optional root As TaskUtterance = Nothing)
        _root = root
        _extras = New List(Of IVariableContext)()
    End Sub

    Public Sub AddContext(context As IVariableContext)
        If context IsNot Nothing Then _extras.Add(context)
    End Sub

    Public Function GetValue(fullLabel As String) As String Implements IVariableContext.GetValue
        If String.IsNullOrEmpty(fullLabel) Then Return ""

        If _root IsNot Nothing Then
            Dim v = FindValue(fullLabel, _root)
            If Not String.IsNullOrEmpty(v) Then Return v
        End If

        For Each ctx In _extras
            If ctx.HasVariable(fullLabel) Then
                Dim v = ctx.GetValue(fullLabel)
                If Not String.IsNullOrEmpty(v) Then Return v
            End If
        Next

        Return ""
    End Function

    Public Function HasVariable(fullLabel As String) As Boolean Implements IVariableContext.HasVariable
        If String.IsNullOrEmpty(fullLabel) Then Return False
        If _root IsNot Nothing AndAlso Not String.IsNullOrEmpty(FindValue(fullLabel, _root)) Then Return True
        Return _extras.Any(Function(c) c.HasVariable(fullLabel))
    End Function

    ' -------------------------------------------------------------------------
    ' Private helpers
    ' -------------------------------------------------------------------------

    Private Shared Function FindValue(fullLabel As String, node As TaskUtterance) As String
        If node Is Nothing Then Return ""

        If String.Equals(node.FullLabel, fullLabel, StringComparison.OrdinalIgnoreCase) Then
            If node.HasSubTasks() Then
                ' Composite: join sub-values.
                Dim parts = node.SubTasks.Where(Function(s) s.Value IsNot Nothing).Select(Function(s) s.Value.ToString()).ToList()
                Return String.Join(" ", parts)
            End If
            Return If(node.Value IsNot Nothing, node.Value.ToString(), "")
        End If

        For Each child In node.SubTasks
            Dim found = FindValue(fullLabel, child)
            If Not String.IsNullOrEmpty(found) Then Return found
        Next

        Return ""
    End Function
End Class
