Option Strict On
Option Explicit On

Imports TaskEngine

''' <summary>
''' Mapping I/O tra flow parent e child per CompiledSubflowTask (nessuna esecuzione del grafo).
''' </summary>
Public NotInheritable Class SubflowTaskExecutor

    Private Sub New()
    End Sub

    ''' <summary>Copia valori dal parent al VariableStore del child secondo le binding.</summary>
    Public Shared Sub ApplyInputMapping(
        parentStore As Dictionary(Of String, Object),
        childStore As Dictionary(Of String, Object),
        bindings As List(Of SubflowIoBinding)
    )
        If bindings Is Nothing OrElse childStore Is Nothing Then
            Return
        End If
        For Each b In bindings
            If b Is Nothing OrElse String.IsNullOrEmpty(b.ToVariable) Then
                Continue For
            End If
            Dim val As Object = Nothing
            Dim fromKey = If(b.FromVariable, "")
            If Not String.IsNullOrEmpty(fromKey) AndAlso parentStore IsNot Nothing AndAlso parentStore.ContainsKey(fromKey) Then
                val = parentStore(fromKey)
            End If
            childStore(b.ToVariable) = val
        Next
    End Sub

    ''' <summary>Copia valori dal child al parent secondo le binding (PopFlow).</summary>
    Public Shared Sub ApplyOutputMapping(
        childStore As Dictionary(Of String, Object),
        parentStore As Dictionary(Of String, Object),
        bindings As List(Of SubflowIoBinding)
    )
        If bindings Is Nothing OrElse parentStore Is Nothing Then
            Return
        End If
        For Each b In bindings
            If b Is Nothing OrElse String.IsNullOrEmpty(b.ToVariable) Then
                Continue For
            End If
            Dim val As Object = Nothing
            Dim fromKey = If(b.FromVariable, "")
            If Not String.IsNullOrEmpty(fromKey) AndAlso childStore IsNot Nothing AndAlso childStore.ContainsKey(fromKey) Then
                val = childStore(fromKey)
            End If
            parentStore(b.ToVariable) = val
        Next
    End Sub
End Class
