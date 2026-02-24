Option Strict On
Option Explicit On
Namespace TaskEngine

''' <summary>
''' Callbacks for side effects (all async)
''' </summary>
Public Interface ITaskEngineCallbacks
    Function OnMessage(text As String) As System.Threading.Tasks.Task
    Function OnLog(message As String) As System.Threading.Tasks.Task
    Function OnBackendCall(endpoint As String, params As Dictionary(Of String, Object)) As System.Threading.Tasks.Task(Of Object)
    Function OnProblemClassify(intents As List(Of String)) As System.Threading.Tasks.Task(Of Object)
    Function OnAIAgent(config As Object) As System.Threading.Tasks.Task(Of Object)
End Interface
End Namespace
