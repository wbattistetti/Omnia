Option Strict On
Option Explicit On

Imports System.IO
Imports System.Security.Cryptography
Imports System.Text

Namespace ElevenLabs

''' <summary>
''' Secret condiviso per <c>POST /elevenlabs/internal/enqueueToolDiagnostic</c>: stessa logica di
''' <c>backend/scripts/ensureDiagnosticBridgeSecret.js</c> (file in <c>Path.GetTempPath()</c>).
''' Priorità: variabile d'ambiente, altrimenti file, altrimenti creazione esclusiva.
''' </summary>
Friend Module OmniaDiagnosticBridgeSecret

    Private ReadOnly LockObj As New Object()
    Private Cached As String = Nothing

    Friend Function ResolveExpectedInternalToolSecret() As String
        SyncLock LockObj
            If Cached IsNot Nothing Then
                Return Cached
            End If

            Dim envVar = Environment.GetEnvironmentVariable("OMNIA_INTERNAL_TOOL_DIAGNOSTIC_SECRET")
            If Not String.IsNullOrWhiteSpace(envVar) Then
                Cached = envVar.Trim()
                Return Cached
            End If

            Dim fp = Path.Combine(Path.GetTempPath(), "omnia-diagnostic-bridge.secret")
            If File.Exists(fp) Then
                Try
                    Dim t = File.ReadAllText(fp, Encoding.UTF8).Trim()
                    If Not String.IsNullOrWhiteSpace(t) Then
                        Cached = t
                        Return Cached
                    End If
                Catch
                End Try
            End If

            Try
                Dim bytes(31) As Byte
                RandomNumberGenerator.Fill(bytes)
                Dim newSecret = BitConverter.ToString(bytes).Replace("-", "").ToLowerInvariant()
                Using fs As New FileStream(fp, FileMode.CreateNew, FileAccess.Write, FileShare.None)
                    Using sw As New StreamWriter(fs, Encoding.UTF8)
                        sw.Write(newSecret)
                    End Using
                End Using
                Cached = newSecret
                Return Cached
            Catch ex As IOException
                If File.Exists(fp) Then
                    Try
                        Cached = File.ReadAllText(fp, Encoding.UTF8).Trim()
                    Catch
                        Cached = ""
                    End Try
                    Return If(Cached, "")
                End If
                LoggerBridgeWriteFailed(ex)
                Return ""
            End Try
        End SyncLock
    End Function

    Private Sub LoggerBridgeWriteFailed(ex As Exception)
        Try
            Global.System.Console.WriteLine("[Omnia·diagnostic·bridge] auto-secret file create failed: " & ex.Message)
        Catch
        End Try
    End Sub

End Module

End Namespace
