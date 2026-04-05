Option Strict On
Option Explicit On
Imports System.Collections.Generic
Imports System.Text.RegularExpressions
Imports TaskEngine

''' <summary>
''' CompiledNlpContract: versione pre-compilata di NLPContract
''' Pre-compila regex patterns a compile-time per migliorare le performance a runtime
''' ✅ NON eredita da NLPContract per evitare dipendenza circolare Engine ↔ Compiler
''' </summary>
Public Class CompiledNlpContract
    ' ✅ Proprietà duplicate da NLPContract (non eredita per evitare dipendenza circolare)
    ''' <summary>
    ''' Nome del template (es. "date", "phone", "address")
    ''' </summary>
    Public Property TemplateName As String

    ''' <summary>
    ''' ID del template
    ''' </summary>
    Public Property TemplateId As String

    ''' <summary>
    ''' ID del template sorgente (per istanze)
    ''' </summary>
    Public Property SourceTemplateId As String

    ''' <summary>
    ''' Mapping tra subId e metadata per l'estrazione
    ''' </summary>
    Public Property DataMapping As Dictionary(Of String, SubDataMappingInfo)

    ''' <summary>
    ''' Array di engines (fonte di verità unica)
    ''' </summary>
    Public Property Engines As List(Of NLPEngine)

    ''' <summary>
    ''' Regex principale pre-compilato (primo pattern)
    ''' </summary>
    Public Property CompiledMainRegex As Regex

    ''' <summary>
    ''' Tutti i pattern regex dell'engine regex abilitato, pre-compilati nello stesso ordine del contratto.
    ''' </summary>
    Public Property CompiledRegexPatterns As List(Of Regex)

    ''' <summary>
    ''' Indica se il contract è valido (tutti i pattern sono compilabili)
    ''' </summary>
    Public Property IsValid As Boolean

    ''' <summary>
    ''' Lista di errori di validazione (se presenti)
    ''' </summary>
    Public Property ValidationErrors As List(Of String)

    Public Sub New()
        DataMapping = New Dictionary(Of String, SubDataMappingInfo)()
        Engines = New List(Of NLPEngine)()
        ValidationErrors = New List(Of String)()
        CompiledRegexPatterns = New List(Of Regex)()
        IsValid = True
    End Sub
End Class
