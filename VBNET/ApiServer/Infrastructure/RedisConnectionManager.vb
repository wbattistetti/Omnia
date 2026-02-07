Option Strict On
Option Explicit On
Imports StackExchange.Redis
Imports System.Threading

Namespace ApiServer.Infrastructure
    ''' <summary>
    ''' ✅ FASE 4: Gestisce la connessione Redis (singleton thread-safe)
    ''' </summary>
    Public Class RedisConnectionManager
        Private Shared _connection As IConnectionMultiplexer
        Private Shared ReadOnly _lock As New Object()
        Private Shared _isConnected As Boolean = False

        ''' <summary>
        ''' Ottiene o crea la connessione Redis (singleton)
        ''' </summary>
        Public Shared Function GetConnection(connectionString As String) As IConnectionMultiplexer
            If _connection Is Nothing OrElse Not _isConnected Then
                SyncLock _lock
                    If _connection Is Nothing OrElse Not _isConnected Then
                        Try
                            _connection = ConnectionMultiplexer.Connect(connectionString)
                            _isConnected = _connection.IsConnected

                            ' Eventi per monitoraggio connessione
                            AddHandler _connection.ConnectionFailed, Sub(sender, e)
                                                                          _isConnected = False
                                                                          Console.WriteLine($"[RedisConnectionManager] Connection failed: {e.FailureType} - {e.Exception?.Message}")
                                                                      End Sub

                            AddHandler _connection.ConnectionRestored, Sub(sender, e)
                                                                          _isConnected = True
                                                                          Console.WriteLine($"[RedisConnectionManager] Connection restored")
                                                                      End Sub

                            Console.WriteLine($"[RedisConnectionManager] Connected to Redis: {connectionString}")
                        Catch ex As Exception
                            _isConnected = False
                            Console.WriteLine($"[RedisConnectionManager] Failed to connect to Redis: {ex.Message}")
                            Throw New Exception($"Failed to connect to Redis: {ex.Message}", ex)
                        End Try
                    End If
                End SyncLock
            End If

            Return _connection
        End Function

        ''' <summary>
        ''' Verifica se la connessione Redis è attiva
        ''' </summary>
        Public Shared Function IsConnected() As Boolean
            Try
                Return _isConnected AndAlso _connection IsNot Nothing AndAlso _connection.IsConnected
            Catch
                Return False
            End Try
        End Function

        ''' <summary>
        ''' Chiude e rilascia la connessione Redis
        ''' </summary>
        Public Shared Sub Dispose()
            SyncLock _lock
                If _connection IsNot Nothing Then
                    Try
                        _connection.Close()
                        _connection.Dispose()
                    Catch
                        ' Ignore errors during disposal
                    Finally
                        _connection = Nothing
                        _isConnected = False
                    End Try
                End If
            End SyncLock
        End Sub
    End Class
End Namespace
