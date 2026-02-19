Option Strict On
Option Explicit On
Imports Microsoft.AspNetCore.Http

Namespace ApiServer.Streaming
    ''' <summary>
    ''' Interfaccia per gestione Server-Sent Events (SSE)
    '''
    ''' Responsabilità:
    ''' - Gestire connessioni SSE (apertura, chiusura, heartbeat)
    ''' - Emettere eventi SSE (message, stateUpdated, error)
    ''' - Gestire riconnessioni e retry
    ''' - Gestire buffer messaggi (per client che si riconnettono)
    ''' </summary>
    Public Interface ISseStreamManager
    ''' <summary>
    ''' Apre una connessione SSE per una sessione
    ''' </summary>
    ''' <param name="sessionId">ID della sessione</param>
    ''' <param name="response">HttpResponse per scrivere eventi SSE</param>
    Sub OpenStream(sessionId As String, response As HttpResponse)

    ''' <summary>
    ''' Emette un evento SSE
    ''' </summary>
    ''' <param name="sessionId">ID della sessione</param>
    ''' <param name="eventType">Tipo evento (message, stateUpdated, error, ecc.)</param>
    ''' <param name="data">Dati dell'evento (oggetto serializzabile)</param>
    Sub EmitEvent(sessionId As String, eventType As String, data As Object)

    ''' <summary>
    ''' Chiude la connessione SSE per una sessione
    ''' </summary>
    ''' <param name="sessionId">ID della sessione</param>
    Sub CloseStream(sessionId As String)

    ''' <summary>
    ''' Verifica se una connessione SSE è aperta
    ''' </summary>
    ''' <param name="sessionId">ID della sessione</param>
    ''' <returns>True se connessione aperta, False altrimenti</returns>
    Function IsStreamOpen(sessionId As String) As Boolean
    End Interface
End Namespace
