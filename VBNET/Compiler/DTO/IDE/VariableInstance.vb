Option Strict On
Option Explicit On
Imports Newtonsoft.Json

''' <summary>
''' VariableInstance: Variabile associata a un'istanza di task.
''' Identity: <c>Id</c> is a GUID; for task-bound rows it equals TaskTreeNode.id.
''' </summary>
Public Class VariableInstance
    <JsonProperty("id")>
    Public Property Id As String

    <JsonProperty("varName")>
    Public Property VarName As String

    <JsonProperty("taskInstanceId")>
    Public Property TaskInstanceId As String

    <JsonProperty("dataPath")>
    Public Property DataPath As String
End Class
