Option Strict On
Option Explicit On
Imports Newtonsoft.Json

''' <summary>
''' CompiledVariable: Variabile per runtime. Chiave VariableStore = <c>Id</c> (GUID = TaskTreeNode.id).
''' </summary>
Public Class CompiledVariable
    <JsonProperty("id")>
    Public Property Id As String

    <JsonProperty("taskInstanceId")>
    Public Property TaskInstanceId As String

    <JsonProperty("values")>
    Public Property Values As List(Of Object)

    Public Sub New()
        Values = New List(Of Object)()
    End Sub
End Class
