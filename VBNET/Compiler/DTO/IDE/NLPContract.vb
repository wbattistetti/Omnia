Option Strict On
Option Explicit On
Imports TaskEngine

''' <summary>
''' Rappresenta un NLP Contract con regex patterns e mapping per l'estrazione dati
''' Input contract dal frontend (IDE)
''' </summary>
Public Class NLPContract
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
    ''' Usa SubDataMappingInfo da Common
    ''' </summary>
    Public Property SubDataMapping As Dictionary(Of String, SubDataMappingInfo)

    ''' <summary>
    ''' ✅ NEW: Array di parsers (fonte di verità unica)
    ''' Usa NLPEngine da Common
    ''' </summary>
    Public Property Parsers As List(Of NLPEngine)

    ''' <summary>
    ''' Test phrases per il GrammarFlow engine
    ''' </summary>
    Public Property TestPhrases As List(Of String)

    Public Sub New()
        SubDataMapping = New Dictionary(Of String, SubDataMappingInfo)()
        Parsers = New List(Of NLPEngine)()
        TestPhrases = New List(Of String)()
    End Sub
End Class

