' ITask.vb
' Interfaccia comune per tutti i task (runtime)

Option Strict On
Option Explicit On

    ''' <summary>
    ''' Interfaccia comune per tutti i task nel runtime engine
    ''' </summary>
    Public Interface ITask
    ReadOnly Property Label As String

    ''' <summary>
    ''' Esegue il task
    ''' </summary>
    ''' <param name="taskNode">Il nodo task corrente</param>
    ''' <param name="taskInstance">L'istanza Task completa</param>
    ''' <param name="onMessage">Handler per mostrare messaggi (per MessageTask) comunica all'UI se va mostrato qualcosa (serve non a runtime ma design time nel debugger </param>
    Sub Execute(taskNode As TaskNode, taskInstance As TaskInstance, onMessage As Action(Of String))
    End Interface

