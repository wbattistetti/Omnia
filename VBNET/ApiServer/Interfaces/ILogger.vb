Option Strict On
Option Explicit On

Namespace ApiServer.Interfaces
    ''' <summary>
    ''' Interfaccia per logging strutturato
    ''' Supporta logging su stdout in formato JSON per osservabilità
    ''' </summary>
    Public Interface ILogger
        ''' <summary>
        ''' Log di debug (dettagli tecnici)
        ''' </summary>
        Sub LogDebug(message As String, Optional data As Object = Nothing)

        ''' <summary>
        ''' Log informativo (eventi normali)
        ''' </summary>
        Sub LogInfo(message As String, Optional data As Object = Nothing)

        ''' <summary>
        ''' Log di warning (situazioni anomale ma non critiche)
        ''' </summary>
        Sub LogWarning(message As String, Optional data As Object = Nothing)

        ''' <summary>
        ''' Log di errore (eccezioni e problemi critici)
        ''' </summary>
        Sub LogError(message As String, ex As Exception, Optional data As Object = Nothing)
    End Interface
End Namespace
