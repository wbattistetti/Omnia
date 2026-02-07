Option Strict On
Option Explicit On
Imports TaskEngine.Orchestrator

Namespace ApiServer.Interfaces
    ''' <summary>
    ''' ✅ STATELESS: Interfaccia per storage dello stato di esecuzione del FlowOrchestrator
    ''' Permette di salvare/caricare ExecutionState da Redis
    ''' </summary>
    Public Interface IExecutionStateStorage
        ''' <summary>
        ''' Recupera ExecutionState da Redis per una sessione
        ''' </summary>
        Function GetExecutionState(sessionId As String) As ExecutionState

        ''' <summary>
        ''' Salva ExecutionState su Redis per una sessione
        ''' </summary>
        Sub SaveExecutionState(sessionId As String, state As ExecutionState)

        ''' <summary>
        ''' Elimina ExecutionState da Redis per una sessione
        ''' </summary>
        Sub DeleteExecutionState(sessionId As String)
    End Interface
End Namespace
