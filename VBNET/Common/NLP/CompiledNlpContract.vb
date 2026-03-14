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
    ''' Array di parsers (legacy, mantenuto per retrocompatibilità)
    ''' </summary>
    Public Property Parsers As List(Of NLPEngine)

    ''' <summary>
    ''' Array di engines (nuovo nome, mappa a Parsers se non presente)
    ''' </summary>
    Public Property Engines As List(Of NLPEngine)
        Get
            ' ✅ Se Engines è Nothing o vuoto, usa Parsers (retrocompatibilità)
            If _engines Is Nothing OrElse _engines.Count = 0 Then
                Return If(Parsers IsNot Nothing, Parsers, New List(Of NLPEngine)())
            End If
            Return _engines
        End Get
        Set(value As List(Of NLPEngine))
            _engines = value
            ' ✅ Sincronizza anche Parsers per retrocompatibilità
            If value IsNot Nothing Then
                Parsers = value
            End If
        End Set
    End Property
    Private _engines As List(Of NLPEngine)

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
        _engines = New List(Of NLPEngine)()
        ValidationErrors = New List(Of String)()
        IsValid = True
    End Sub
End Class
