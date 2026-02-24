Option Strict On
Option Explicit On
Imports TaskEngine
Namespace TaskEngine

''' <summary>
''' Implementation of ITaskEngineCallbacks that adapts to Action callbacks
''' Supports translation resolution and SSE event emission
''' </summary>
Public Class TaskEngineCallbacks
    Implements ITaskEngineCallbacks

    Private ReadOnly _messageCallback As Action(Of String, String, Integer)
    Private ReadOnly _resolveTranslation As Func(Of String, String, String, String) ' projectId, locale, textKey -> translatedText
    Private ReadOnly _projectId As String
    Private ReadOnly _locale As String
    Private ReadOnly _sseEmitter As Action(Of String, Object)

    ''' <summary>
    ''' Costruttore legacy per backward compatibility
    ''' </summary>
    Public Sub New(messageCallback As Action(Of String, String, Integer))
        _messageCallback = messageCallback
        _resolveTranslation = Nothing
        _projectId = Nothing
        _locale = Nothing
        _sseEmitter = Nothing
    End Sub

    ''' <summary>
    ''' Nuovo costruttore con risoluzione traduzioni e SSE emitter
    ''' </summary>
    Public Sub New(resolveTranslation As Func(Of String, String, String, String), projectId As String, locale As String, sseEmitter As Action(Of String, Object))
        _messageCallback = Nothing
        _resolveTranslation = resolveTranslation
        _projectId = projectId
        _locale = locale
        _sseEmitter = sseEmitter
    End Sub

    Public Async Function OnMessage(text As String) As System.Threading.Tasks.Task Implements ITaskEngineCallbacks.OnMessage
        Dim translatedText As String = text
        Dim textKey As String = text

        ' ✅ Risolvi traduzione se text è un textKey e abbiamo resolveTranslation
        If _resolveTranslation IsNot Nothing AndAlso Not String.IsNullOrEmpty(_projectId) AndAlso Not String.IsNullOrEmpty(_locale) Then
            Dim resolved = _resolveTranslation(_projectId, _locale, text)
            If Not String.IsNullOrEmpty(resolved) Then
                translatedText = resolved
            End If
        End If

        ' ✅ Emetti evento SSE "message"
        If _sseEmitter IsNot Nothing Then
            Dim messageData = New With {
                .text = translatedText,
                .textKey = textKey,
                .timestamp = DateTime.UtcNow.ToString("O")
            }
            _sseEmitter("message", messageData)
        End If

        ' ✅ Legacy callback support
        If _messageCallback IsNot Nothing Then
            _messageCallback(translatedText, textKey, 0)
        End If

        ' ✅ Async Function che ritorna Task non ha bisogno di Return
    End Function

    Public Async Function OnLog(message As String) As System.Threading.Tasks.Task Implements ITaskEngineCallbacks.OnLog
        Console.WriteLine($"[TaskEngine] {message}")
    End Function

    Public Async Function OnBackendCall(endpoint As String, params As Dictionary(Of String, Object)) As System.Threading.Tasks.Task(Of Object) Implements ITaskEngineCallbacks.OnBackendCall
        ' TODO: Implement backend call callback
        Return Nothing
    End Function

    Public Async Function OnProblemClassify(intents As List(Of String)) As System.Threading.Tasks.Task(Of Object) Implements ITaskEngineCallbacks.OnProblemClassify
        ' TODO: Implement problem classify callback
        Return Nothing
    End Function

    Public Async Function OnAIAgent(config As Object) As System.Threading.Tasks.Task(Of Object) Implements ITaskEngineCallbacks.OnAIAgent
        ' TODO: Implement AI agent callback
        Return Nothing
    End Function
End Class
End Namespace
