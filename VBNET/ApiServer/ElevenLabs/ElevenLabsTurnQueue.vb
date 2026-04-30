Option Strict On
Option Explicit On

Imports System.Collections.Concurrent
Imports System.Threading
Imports System.Threading.Tasks

Namespace ElevenLabs

''' <summary>
''' Thread-safe queue with async wait for the next agent turn (used by GET readPrompt long-poll).
''' </summary>
Public NotInheritable Class ElevenLabsTurnQueue
    Private ReadOnly _q As New ConcurrentQueue(Of ElevenLabsAgentTurnPayload)()
    Private ReadOnly _signal As New SemaphoreSlim(0, Integer.MaxValue)

    Public Sub Enqueue(item As ElevenLabsAgentTurnPayload)
        If item Is Nothing Then Throw New ArgumentNullException(NameOf(item))
        _q.Enqueue(item)
        _signal.Release()
    End Sub

    Public Async Function DequeueAsync(ct As CancellationToken) As Task(Of ElevenLabsAgentTurnPayload)
        Await _signal.WaitAsync(ct).ConfigureAwait(False)
        Dim item As ElevenLabsAgentTurnPayload = Nothing
        If _q.TryDequeue(item) Then
            Return item
        End If
        Throw New InvalidOperationException("ElevenLabs turn queue was signalled but empty.")
    End Function
End Class

End Namespace
