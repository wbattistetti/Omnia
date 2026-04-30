Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports System.IO
Imports DotNetEnv

Namespace Infrastructure

''' <summary>
''' Carica file .env lungo la catena da cwd / BaseDirectory verso l’alto (e verso le radici padre),
''' così le variabili in root repo o in <c>backend/.env</c> non vengono saltate da un .env parziale
''' in una sottocartella. Per directory: <c>.env</c>, poi <c>.env.local</c>, poi opzionalmente
''' <c>backend/.env</c> e <c>backend/.env.local</c> (come <c>backend/server.js</c>). Ultimo caricamento vince.
''' Alternativa: <c>OMNIA_DOTENV_PATH</c> (singolo file).
''' </summary>
Public NotInheritable Class OmniaEnvLoader

    Private Sub New()
    End Sub

    Public Shared Sub LoadDotEnvLocal()
        If TryLoadExplicitDotEnvPath() Then Return

        Dim seen As New HashSet(Of String)(StringComparer.OrdinalIgnoreCase)
        Dim orderedDirs As New List(Of String)()

        Dim addDir =
            Sub(root As String)
                If String.IsNullOrWhiteSpace(root) Then Return
                Try
                    Dim full = Path.GetFullPath(root)
                    If seen.Add(full) Then orderedDirs.Add(full)
                Catch
                End Try
            End Sub

        Dim walk =
            Sub(start As String)
                Dim d = start
                For i = 1 To 20
                    addDir(d)
                    Dim parent = Directory.GetParent(d)
                    If parent Is Nothing Then Exit For
                    d = parent.FullName
                Next
            End Sub

        walk(Directory.GetCurrentDirectory())
        Dim bd = AppContext.BaseDirectory
        If Not String.IsNullOrEmpty(bd) Then walk(bd)

        Dim any As Boolean = False
        For Each d In orderedDirs
            any = LoadEnvPairInDirectory(d, any)
            ' Stesso pattern del backend Node: variabili spesso solo in backend/.env
            Dim be = Path.Combine(d, "backend")
            If Directory.Exists(be) Then
                any = LoadEnvPairInDirectory(be, any)
            End If
        Next

        If Not any Then
            Console.WriteLine("[OmniaEnvLoader] Nessun .env trovato nella catena (né backend/.env); uso solo variabili di processo.")
        End If
    End Sub

    Private Shared Function LoadEnvPairInDirectory(dir As String, any As Boolean) As Boolean
        Dim pEnv = Path.Combine(dir, ".env")
        Dim pLocal = Path.Combine(dir, ".env.local")
        If File.Exists(pEnv) Then
            Env.Load(pEnv)
            Console.WriteLine($"[OmniaEnvLoader] Loaded: {pEnv}")
            any = True
        End If
        If File.Exists(pLocal) Then
            Env.Load(pLocal)
            Console.WriteLine($"[OmniaEnvLoader] Loaded: {pLocal}")
            any = True
        End If
        Return any
    End Function

    Private Shared Function TryLoadExplicitDotEnvPath() As Boolean
        Dim explicitPath = Environment.GetEnvironmentVariable("OMNIA_DOTENV_PATH")
        If String.IsNullOrWhiteSpace(explicitPath) Then Return False
        Dim full = Path.GetFullPath(explicitPath.Trim())
        If Not File.Exists(full) Then
            Console.WriteLine($"[OmniaEnvLoader] OMNIA_DOTENV_PATH impostato ma file assente: {full}")
            Return False
        End If
        Env.Load(full)
        Console.WriteLine($"[OmniaEnvLoader] Loaded (OMNIA_DOTENV_PATH): {full}")
        Return True
    End Function

End Class

End Namespace
