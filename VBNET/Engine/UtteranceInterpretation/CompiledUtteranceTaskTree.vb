Option Strict On
Option Explicit On

Imports Compiler

''' <summary>Risolve un <see cref="CompiledUtteranceTask"/> per Id nell'albero (stessa istanza del grafo compilato, motori inclusi).</summary>
Public Module CompiledUtteranceTaskTree

    Public Function FindById(root As CompiledUtteranceTask, taskId As String) As CompiledUtteranceTask
        If root Is Nothing OrElse String.IsNullOrEmpty(taskId) Then Return Nothing
        If String.Equals(root.Id, taskId, StringComparison.Ordinal) Then Return root
        If root.SubTasks Is Nothing Then Return Nothing
        For Each child As CompiledUtteranceTask In root.SubTasks
            Dim found = FindById(child, taskId)
            If found IsNot Nothing Then Return found
        Next
        Return Nothing
    End Function

End Module
