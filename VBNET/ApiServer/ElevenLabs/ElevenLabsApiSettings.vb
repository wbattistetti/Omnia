Option Strict On
Option Explicit On

Namespace ElevenLabs

    ''' <summary>
    ''' Origine API ElevenLabs: URL da <c>ELEVENLABS_API_BASE</c>. La chiave API si legge da
    ''' <c>Environment.GetEnvironmentVariable("ELEVENLABS_API_KEY")</c> negli handler (come prima);
    ''' non è obbligatoria all'avvio. DotNetEnv può sovrascrivere con stringhe vuote da file .env:
    ''' usare <see cref="CapturePreDotEnvElevenLabs"/> prima del load e <see cref="AfterDotEnvFilesLoaded"/> dopo.
    ''' </summary>
    Public NotInheritable Class ElevenLabsApiSettings

        Private Shared ReadOnly LockObj As New Object()
        Private Shared _cachedOrigin As String = Nothing
        Private Shared _preLoadApiKey As String = Nothing
        Private Shared _preLoadApiBase As String = Nothing

        ''' <summary>
        ''' Chiamare subito prima di <c>OmniaEnvLoader.LoadDotEnvLocal</c>: salva i valori già nel processo
        ''' (variabile d'ambiente sistema / utente ereditata all'avvio) così non si perdono se un .env contiene la stessa chiave vuota.
        ''' </summary>
        Public Shared Sub CapturePreDotEnvElevenLabs()
            _preLoadApiKey = Environment.GetEnvironmentVariable("ELEVENLABS_API_KEY")
            _preLoadApiBase = Environment.GetEnvironmentVariable("ELEVENLABS_API_BASE")
        End Sub

        ''' <summary>
        ''' Chiamare subito dopo il caricamento dei file .env: ripristina chiavi obliterate da righe vuote e,
        ''' se ancora assenti, legge User/Machine (Windows).
        ''' </summary>
        Public Shared Sub AfterDotEnvFilesLoaded()
            RestoreIfEmpty("ELEVENLABS_API_KEY", _preLoadApiKey)
            RestoreIfEmpty("ELEVENLABS_API_BASE", _preLoadApiBase)
            FillFromTargetIfEmpty("ELEVENLABS_API_KEY", EnvironmentVariableTarget.User)
            FillFromTargetIfEmpty("ELEVENLABS_API_KEY", EnvironmentVariableTarget.Machine)
            FillFromTargetIfEmpty("ELEVENLABS_API_BASE", EnvironmentVariableTarget.User)
            FillFromTargetIfEmpty("ELEVENLABS_API_BASE", EnvironmentVariableTarget.Machine)
        End Sub

        Private Shared Sub RestoreIfEmpty(name As String, preLoad As String)
            If Not String.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable(name)) Then Return
            If String.IsNullOrWhiteSpace(preLoad) Then Return
            Environment.SetEnvironmentVariable(name, preLoad)
            Console.WriteLine($"[ElevenLabs] Ripristinato {name} dal valore presente nel processo prima del load .env.")
        End Sub

        Private Shared Sub FillFromTargetIfEmpty(name As String, target As EnvironmentVariableTarget)
            If Not String.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable(name)) Then Return
            Try
                Dim v = Environment.GetEnvironmentVariable(name, target)
                If String.IsNullOrWhiteSpace(v) Then Return
                Environment.SetEnvironmentVariable(name, v)
                Console.WriteLine($"[ElevenLabs] Impostato {name} da ambiente {target}.")
            Catch
            End Try
        End Sub

        ''' <summary>Solo base URL obbligatoria per costruire le richieste HTTP proxy.</summary>
        Public Shared Sub ValidateAtStartup()
            EnsureResolved()
        End Sub

        Public Shared Function GetApiBaseUrl() As String
            EnsureResolved()
            Return _cachedOrigin
        End Function

        Private Shared Sub EnsureResolved()
            If _cachedOrigin IsNot Nothing Then Return
            SyncLock LockObj
                If _cachedOrigin IsNot Nothing Then Return
                Dim raw = NormalizeEnvValue(Environment.GetEnvironmentVariable("ELEVENLABS_API_BASE"))
                If String.IsNullOrWhiteSpace(raw) Then
                    Console.WriteLine("[ElevenLabs] ELEVENLABS_API_BASE è vuota o assente dopo il caricamento .env.")
                    Throw New InvalidOperationException(
                    "ELEVENLABS_API_BASE non configurata. Metti ELEVENLABS_API_BASE in backend/.env o in .env nella root " &
                    "del repo (stesso valore di backend/.env.example, es. https://api.eu.residency.elevenlabs.io/v1), " &
                    "oppure nella variabile d'ambiente utente/sistema.")
                End If
                _cachedOrigin = NormalizeElevenLabsApiOrigin(raw)
            End SyncLock
        End Sub

        ''' <summary>Rimuove virgolette tipiche dei file .env e spazi.</summary>
        Private Shared Function NormalizeEnvValue(value As String) As String
            If String.IsNullOrWhiteSpace(value) Then Return ""
            Dim t = value.Trim()
            If t.Length >= 2 AndAlso ((t.StartsWith(""""c) AndAlso t.EndsWith(""""c)) OrElse
            (t.StartsWith("'"c) AndAlso t.EndsWith("'"c))) Then
                t = t.Substring(1, t.Length - 2).Trim()
            End If
            Return t
        End Function

        Private Shared Function NormalizeElevenLabsApiOrigin(raw As String) As String
            Dim t = NormalizeEnvValue(raw).TrimEnd("/"c)
            If t.EndsWith("/v1", StringComparison.OrdinalIgnoreCase) Then
                t = t.Substring(0, t.Length - 3).TrimEnd("/"c)
            End If

            Dim u As Uri = Nothing
            If Not Uri.TryCreate(t, UriKind.Absolute, u) Then
                Throw New InvalidOperationException(
                "ELEVENLABS_API_BASE non è un URL assoluto valido. Verifica virgolette/spazi nel file .env.")
            End If
            If Not String.Equals(u.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase) Then
                Throw New InvalidOperationException("ELEVENLABS_API_BASE deve usare https.")
            End If

            Return u.GetLeftPart(UriPartial.Authority)
        End Function

    End Class

End Namespace
