' Canonical translation keys: "<kind>:<uuid>" or legacy "runtime.*" — aligned with src/utils/translationKeys.ts
Option Strict On
Option Explicit On

Imports System.Text.RegularExpressions

''' <summary>
''' Validates translation keys for compiled tasks and runtime resolution.
''' </summary>
Public Module TranslationKeyCanonical

    Private ReadOnly UuidRegex As New Regex(
        "^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
        RegexOptions.IgnoreCase Or RegexOptions.Compiled)

    Private ReadOnly CanonicalKeyRegex As New Regex(
        "^(slot|variable|task|flow|interface):[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
        RegexOptions.IgnoreCase Or RegexOptions.Compiled)

    ''' <summary>
    ''' True if key is canonical kind:uuid (lowercase uuid part allowed).
    ''' </summary>
    Public Function IsCanonicalTranslationKey(text As String) As Boolean
        If String.IsNullOrWhiteSpace(text) Then Return False
        Return CanonicalKeyRegex.IsMatch(text.Trim())
    End Function

    ''' <summary>
    ''' Keys allowed in the flat translations map: canonical or runtime.* composite keys.
    ''' </summary>
    Public Function IsValidTranslationStoreKey(text As String) As Boolean
        If String.IsNullOrWhiteSpace(text) Then Return False
        Dim t = text.Trim()
        If t.StartsWith("runtime.", StringComparison.OrdinalIgnoreCase) Then Return True
        Return IsCanonicalTranslationKey(t)
    End Function

    ''' <summary>
    ''' Throws if the SayMessage text parameter is not a valid translation store key.
    ''' </summary>
    Public Sub ValidateTranslationKeyParameterOrThrow(textKey As String, context As String)
        If String.IsNullOrWhiteSpace(textKey) Then
            Throw New InvalidOperationException($"{context}: translation key is empty.")
        End If
        Dim t = textKey.Trim()
        If Not IsValidTranslationStoreKey(t) Then
            Throw New InvalidOperationException(
                $"{context}: text must be a canonical translation key (e.g. task:<guid>) or runtime.* key, got '{t}'.")
        End If
    End Sub

End Module
