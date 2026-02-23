Option Strict On
Option Explicit On
Imports System.Linq
Imports System.Text.RegularExpressions

''' <summary>
''' CompiledNlpContract: versione pre-compilata di NLPContract
''' Pre-compila regex patterns a compile-time per migliorare le performance a runtime
''' </summary>
Public Class CompiledNlpContract
    Inherits NLPContract

    ''' <summary>
    ''' Regex principale pre-compilato (primo pattern)
    ''' </summary>
    Public Property CompiledMainRegex As Regex

    ''' <summary>
    ''' Regex per subData pre-compilati (keyed by canonicalKey o pattern index)
    ''' </summary>
    Public Property CompiledSubRegexes As Dictionary(Of String, Regex)

    ''' <summary>
    ''' Regex per ambiguità pre-compilato (se presente)
    ''' </summary>
    Public Property CompiledAmbiguityRegex As Regex

    ''' <summary>
    ''' Indica se il contract è valido (tutti i pattern sono compilabili)
    ''' </summary>
    Public Property IsValid As Boolean

    ''' <summary>
    ''' Lista di errori di validazione (se presenti)
    ''' </summary>
    Public Property ValidationErrors As List(Of String)

    Public Sub New()
        MyBase.New()
        CompiledSubRegexes = New Dictionary(Of String, Regex)()
        ValidationErrors = New List(Of String)()
        IsValid = True
    End Sub

    ''' <summary>
    ''' Crea un CompiledNlpContract da un NLPContract base
    ''' Pre-compila tutti i pattern regex
    ''' </summary>
    Public Shared Function Compile(baseContract As NLPContract) As CompiledNlpContract
        Dim compiled As New CompiledNlpContract()

        ' Copia tutte le proprietà base
        compiled.TemplateName = baseContract.TemplateName
        compiled.TemplateId = baseContract.TemplateId
        compiled.SourceTemplateId = baseContract.SourceTemplateId
        compiled.SubDataMapping = baseContract.SubDataMapping
        compiled.Contracts = baseContract.Contracts ' ✅ NEW: Copy Contracts directly
        ' Mantenuto per retrocompatibilità
        compiled.Regex = baseContract.Regex
        compiled.Rules = baseContract.Rules
        compiled.Ner = baseContract.Ner
        compiled.Llm = baseContract.Llm

        ' ✅ NEW: Pre-compila regex patterns da Contracts invece di baseContract.Regex
        Dim regexContract = baseContract.Contracts?.FirstOrDefault(Function(c) c.Type = "regex" AndAlso c.Enabled)
        If regexContract IsNot Nothing AndAlso regexContract.Patterns IsNot Nothing Then
            ' Compila main pattern (primo pattern)
            If regexContract.Patterns.Count > 0 Then
                Try
                    compiled.CompiledMainRegex = New Regex(regexContract.Patterns(0), RegexOptions.IgnoreCase Or RegexOptions.Compiled)
                Catch ex As Exception
                    compiled.ValidationErrors.Add($"Main regex pattern invalid: {regexContract.Patterns(0)}. Error: {ex.Message}")
                    compiled.IsValid = False
                End Try
            End If

            ' Compila sub patterns (se presenti)
            For i As Integer = 1 To regexContract.Patterns.Count - 1
                Dim pattern = regexContract.Patterns(i)
                Dim key As String = If(i <= regexContract.PatternModes.Count - 1, regexContract.PatternModes(i), $"pattern_{i}")
                Try
                    compiled.CompiledSubRegexes(key) = New Regex(pattern, RegexOptions.IgnoreCase Or RegexOptions.Compiled)
                Catch ex As Exception
                    compiled.ValidationErrors.Add($"Sub regex pattern invalid (key: {key}): {pattern}. Error: {ex.Message}")
                    compiled.IsValid = False
                End Try
            Next
        End If

        ' Compila ambiguity pattern (se presente)
        If regexContract IsNot Nothing AndAlso
           regexContract.Ambiguity IsNot Nothing AndAlso
           regexContract.Ambiguity.AmbiguousValues IsNot Nothing AndAlso
           Not String.IsNullOrEmpty(regexContract.Ambiguity.AmbiguousValues.Pattern) Then
            Try
                compiled.CompiledAmbiguityRegex = New Regex(regexContract.Ambiguity.AmbiguousValues.Pattern, RegexOptions.IgnoreCase Or RegexOptions.Compiled)
            Catch ex As Exception
                compiled.ValidationErrors.Add($"Ambiguity regex pattern invalid: {regexContract.Ambiguity.AmbiguousValues.Pattern}. Error: {ex.Message}")
                compiled.IsValid = False
            End Try
        End If

        Return compiled
    End Function
End Class

