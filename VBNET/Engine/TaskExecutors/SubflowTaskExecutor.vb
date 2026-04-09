Option Strict On
Option Explicit On

Imports TaskEngine

''' <summary>
''' Policy S2: mapping esplicito parent.var &lt;-&gt; child interface parameter (nessun merge per chiave, nessun proxy).
''' </summary>
Public NotInheritable Class SubflowTaskExecutor

    Private Sub New()
    End Sub

    ''' <summary>PushFlow: child[interfaceParameterId] = parent[parentVariableId].</summary>
    Public Shared Sub ApplyPushBindings(
        parentStore As Dictionary(Of String, Object),
        childStore As Dictionary(Of String, Object),
        bindings As List(Of SubflowBinding)
    )
        If bindings Is Nothing OrElse childStore Is Nothing Then Return
        For Each b In bindings
            If b Is Nothing Then Continue For
            Dim cId = If(b.InterfaceParameterId, "").Trim()
            Dim pId = If(b.ParentVariableId, "").Trim()
            If String.IsNullOrEmpty(cId) OrElse String.IsNullOrEmpty(pId) Then Continue For
            Dim val As Object = Nothing
            If parentStore IsNot Nothing AndAlso parentStore.ContainsKey(pId) Then
                val = parentStore(pId)
            End If
            childStore(cId) = val
        Next
    End Sub

    ''' <summary>PopFlow: parent[parentVariableId] = child[interfaceParameterId].</summary>
    Public Shared Sub ApplyPopBindings(
        childStore As Dictionary(Of String, Object),
        parentStore As Dictionary(Of String, Object),
        bindings As List(Of SubflowBinding)
    )
        If bindings Is Nothing OrElse parentStore Is Nothing Then Return
        For Each b In bindings
            If b Is Nothing Then Continue For
            Dim cId = If(b.InterfaceParameterId, "").Trim()
            Dim pId = If(b.ParentVariableId, "").Trim()
            If String.IsNullOrEmpty(cId) OrElse String.IsNullOrEmpty(pId) Then Continue For
            Dim val As Object = Nothing
            If childStore IsNot Nothing AndAlso childStore.ContainsKey(cId) Then
                val = childStore(cId)
            End If
            parentStore(pId) = val
        Next
    End Sub
End Class
