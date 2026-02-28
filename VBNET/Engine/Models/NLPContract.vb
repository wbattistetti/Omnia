Option Strict On
Option Explicit On

''' <summary>
''' Rappresenta un NLP Contract con regex patterns e mapping per l'estrazione dati
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
    ''' </summary>
    Public Property SubDataMapping As Dictionary(Of String, SubDataMappingInfo)

    ''' <summary>
    ''' ✅ NEW: Array di parsers (fonte di verità unica)
    ''' </summary>
    Public Property Parsers As List(Of NLPContractEngine)

    Public Sub New()
        SubDataMapping = New Dictionary(Of String, SubDataMappingInfo)()
        Parsers = New List(Of NLPContractEngine)()
    End Sub
End Class

''' <summary>
''' ✅ NEW: Rappresenta un singolo engine contract nell'array contracts[]
''' Questo è il nuovo modello unificato
''' </summary>
Public Class NLPContractEngine
    ''' <summary>
    ''' Tipo di engine: "regex", "rules", "ner", "llm", "embedding"
    ''' </summary>
    Public Property Type As String

    ''' <summary>
    ''' Se l'engine è abilitato
    ''' </summary>
    Public Property Enabled As Boolean

    ''' <summary>
    ''' Patterns regex (solo per type="regex")
    ''' </summary>
    Public Property Patterns As List(Of String)

    ''' <summary>
    ''' Test cases
    ''' </summary>
    Public Property TestCases As List(Of String)

    ''' <summary>
    ''' Extractor code (solo per type="rules")
    ''' </summary>
    Public Property ExtractorCode As String

    ''' <summary>
    ''' Validators (solo per type="rules")
    ''' </summary>
    Public Property Validators As List(Of Object)

    ''' <summary>
    ''' Entity types (solo per type="ner")
    ''' </summary>
    Public Property EntityTypes As List(Of String)

    ''' <summary>
    ''' Confidence (solo per type="ner")
    ''' </summary>
    Public Property Confidence As Double

    ''' <summary>
    ''' System prompt (solo per type="llm")
    ''' </summary>
    Public Property SystemPrompt As String

    ''' <summary>
    ''' User prompt template (solo per type="llm")
    ''' </summary>
    Public Property UserPromptTemplate As String

    ''' <summary>
    ''' Response schema (solo per type="llm")
    ''' </summary>
    Public Property ResponseSchema As Object

    Public Sub New()
        Enabled = True
        Patterns = New List(Of String)()
        TestCases = New List(Of String)()
        Validators = New List(Of Object)()
        EntityTypes = New List(Of String)()
        Confidence = 0.7
    End Sub
End Class

''' <summary>
''' Mapping info for a composite sub-field.
''' GroupName is the REQUIRED technical regex group name (format: s[0-9]+ or g_[a-f0-9]{12}).
''' Label is required and used for UI display only.
''' Neither Label nor any semantic name must ever appear as a regex group name.
''' </summary>
Public Class SubDataMappingInfo
    ''' <summary>
    ''' Required. Technical regex group name (format: s[0-9]+ or g_[a-f0-9]{12}).
    ''' Sole source of truth for extraction. Must match the named group in the pattern.
    ''' </summary>
    Public Property GroupName As String

    ''' <summary>Required. UI label — never enters the regex.</summary>
    Public Property Label As String

    ''' <summary>Data type (e.g. "number", "text", "date").</summary>
    Public Property Type As String

    ''' <summary>
    ''' Indice del pattern da usare (per context-aware extraction)
    ''' </summary>
    Public Property PatternIndex As Integer?
End Class

