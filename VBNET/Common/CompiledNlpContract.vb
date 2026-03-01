Option Strict On
Option Explicit On
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
    Public Property SubDataMapping As Dictionary(Of String, SubDataMappingInfo)

    ''' <summary>
    ''' Array di parsers (fonte di verità unica)
    ''' </summary>
    Public Property Parsers As List(Of NLPEngine)

    ''' <summary>
    ''' Regex principale pre-compilato (primo pattern)
    ''' </summary>
    Public Property CompiledMainRegex As Regex

    ''' <summary>
    ''' Indica se il contract è valido (tutti i pattern sono compilabili)
    ''' </summary>
    Public Property IsValid As Boolean

    ''' <summary>
    ''' Lista di errori di validazione (se presenti)
    ''' </summary>
    Public Property ValidationErrors As List(Of String)

    Public Sub New()
        SubDataMapping = New Dictionary(Of String, SubDataMappingInfo)()
        Parsers = New List(Of NLPEngine)()
        ValidationErrors = New List(Of String)()
        IsValid = True
    End Sub
End Class
