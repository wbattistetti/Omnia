' GlobalVariableContext.vb
' Implementazione del contesto globale delle variabili

Option Strict On
Option Explicit On

''' <summary>
''' Implementazione del contesto globale delle variabili
''' Cerca prima nel TaskInstance corrente, poi in altri contesti se disponibili
''' </summary>
Public Class GlobalVariableContext
    Implements IVariableContext

    Private ReadOnly _taskInstance As TaskInstance
    Private ReadOnly _additionalContexts As List(Of IVariableContext)

    ''' <summary>
    ''' Costruttore
    ''' </summary>
    ''' <param name="taskInstance">TaskInstance corrente (opzionale)</param>
    Public Sub New(Optional taskInstance As TaskInstance = Nothing)
        Me._taskInstance = taskInstance
        Me._additionalContexts = New List(Of IVariableContext)()
    End Sub

    ''' <summary>
    ''' Aggiunge un contesto aggiuntivo per la ricerca variabili
    ''' </summary>
    Public Sub AddContext(context As IVariableContext)
        If context IsNot Nothing Then
            _additionalContexts.Add(context)
        End If
    End Sub

    ''' <summary>
    ''' Ottiene il valore di una variabile usando FullLabel come chiave
    ''' </summary>
    Public Function GetValue(fullLabel As String) As String Implements IVariableContext.GetValue
        If String.IsNullOrEmpty(fullLabel) Then
            Return ""
        End If

        ' 1. Cerca nel TaskInstance corrente
        If _taskInstance IsNot Nothing Then
            Dim value As String = GetValueFromTaskInstance(fullLabel, _taskInstance)
            If Not String.IsNullOrEmpty(value) Then
                Return value
            End If
        End If

        ' 2. Cerca nei contesti aggiuntivi
        For Each context As IVariableContext In _additionalContexts
            If context.HasVariable(fullLabel) Then
                Dim value As String = context.GetValue(fullLabel)
                If Not String.IsNullOrEmpty(value) Then
                    Return value
                End If
            End If
        Next

        Return ""
    End Function

    ''' <summary>
    ''' Verifica se una variabile esiste nel contesto
    ''' </summary>
    Public Function HasVariable(fullLabel As String) As Boolean Implements IVariableContext.HasVariable
        If String.IsNullOrEmpty(fullLabel) Then
            Return False
        End If

        ' 1. Verifica nel TaskInstance corrente
        If _taskInstance IsNot Nothing Then
            If HasVariableInTaskInstance(fullLabel, _taskInstance) Then
                Return True
            End If
        End If

        ' 2. Verifica nei contesti aggiuntivi
        For Each context As IVariableContext In _additionalContexts
            If context.HasVariable(fullLabel) Then
                Return True
            End If
        Next

        Return False
    End Function

    ''' <summary>
    ''' Cerca una variabile nel TaskInstance usando FullLabel
    ''' </summary>
    Private Function GetValueFromTaskInstance(fullLabel As String, taskInstance As TaskInstance) As String
        If taskInstance Is Nothing OrElse taskInstance.TaskList Is Nothing Then
            Return ""
        End If

        ' Cerca il nodo con questa FullLabel
        Dim node As TaskNode = FindNodeByFullLabel(fullLabel, taskInstance)
        If node Is Nothing Then
            Return ""
        End If

        ' Se è un task composito, costruisci il valore dai subTasks
        If node.HasSubTasks() Then
            Dim valueParts As New List(Of String)()
            For Each subTask As TaskNode In node.SubTasks
                If subTask.Value IsNot Nothing Then
                    valueParts.Add(subTask.Value.ToString())
                End If
            Next
            Return String.Join(" ", valueParts)
        ElseIf node.Value IsNot Nothing Then
            Return node.Value.ToString()
        End If

        Return ""
    End Function

    ''' <summary>
    ''' Verifica se una variabile esiste nel TaskInstance
    ''' </summary>
    Private Function HasVariableInTaskInstance(fullLabel As String, taskInstance As TaskInstance) As Boolean
        Return FindNodeByFullLabel(fullLabel, taskInstance) IsNot Nothing
    End Function

    ''' <summary>
    ''' Trova un nodo nel TaskInstance usando FullLabel
    ''' </summary>
    Private Function FindNodeByFullLabel(fullLabel As String, taskInstance As TaskInstance) As TaskNode
        If taskInstance Is Nothing OrElse taskInstance.TaskList Is Nothing Then
            Return Nothing
        End If

        ' Cerca ricorsivamente in tutti i nodi
        For Each mainTask As TaskNode In taskInstance.TaskList
            Dim found As TaskNode = FindNodeRecursive(mainTask, fullLabel)
            If found IsNot Nothing Then
                Return found
            End If
        Next

        Return Nothing
    End Function

    ''' <summary>
    ''' Cerca ricorsivamente un nodo con la FullLabel specificata
    ''' </summary>
    Private Function FindNodeRecursive(node As TaskNode, fullLabel As String) As TaskNode
        If node Is Nothing Then
            Return Nothing
        End If

        ' Verifica se questo nodo ha la FullLabel cercata
        If String.Equals(node.FullLabel, fullLabel, StringComparison.OrdinalIgnoreCase) Then
            Return node
        End If

        ' Cerca ricorsivamente nei subTasks
        If node.SubTasks IsNot Nothing Then
            For Each subTask As TaskNode In node.SubTasks
                Dim found As TaskNode = FindNodeRecursive(subTask, fullLabel)
                If found IsNot Nothing Then
                    Return found
                End If
            Next
        End If

        Return Nothing
    End Function
End Class

