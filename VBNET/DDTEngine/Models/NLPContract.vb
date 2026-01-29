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
    ''' Mapping tra subId e canonicalKey per l'estrazione
    ''' </summary>
    Public Property SubDataMapping As Dictionary(Of String, SubDataMappingInfo)

    ''' <summary>
    ''' Configurazione regex per l'estrazione
    ''' </summary>
    Public Property Regex As RegexConfig

    ''' <summary>
    ''' Regole di estrazione e validazione
    ''' </summary>
    Public Property Rules As RulesConfig

    ''' <summary>
    ''' Configurazione NER (opzionale)
    ''' </summary>
    Public Property Ner As NERConfig

    ''' <summary>
    ''' Configurazione LLM (opzionale)
    ''' </summary>
    Public Property Llm As LLMConfig

    Public Sub New()
        SubDataMapping = New Dictionary(Of String, SubDataMappingInfo)()
        Regex = New RegexConfig()
        Rules = New RulesConfig()
        Ner = New NERConfig()
        Llm = New LLMConfig()
    End Sub
End Class

''' <summary>
''' Informazioni di mapping per un subData
''' </summary>
Public Class SubDataMappingInfo
    ''' <summary>
    ''' Chiave canonica (es. "day", "month", "year")
    ''' </summary>
    Public Property CanonicalKey As String

    ''' <summary>
    ''' Etichetta del dato
    ''' </summary>
    Public Property Label As String

    ''' <summary>
    ''' Tipo del dato
    ''' </summary>
    Public Property Type As String

    ''' <summary>
    ''' Indice del pattern da usare (per context-aware extraction)
    ''' </summary>
    Public Property PatternIndex As Integer?
End Class

''' <summary>
''' Configurazione regex per l'estrazione
''' </summary>
Public Class RegexConfig
    ''' <summary>
    ''' Lista di pattern regex (il primo è il main pattern)
    ''' </summary>
    Public Property Patterns As List(Of String)

    ''' <summary>
    ''' Modalità dei pattern (es. "main", "day", "month", "year")
    ''' </summary>
    Public Property PatternModes As List(Of String)

    ''' <summary>
    ''' Pattern per rilevare valori ambigui
    ''' </summary>
    Public Property AmbiguityPattern As String

    ''' <summary>
    ''' Configurazione ambiguità
    ''' </summary>
    Public Property Ambiguity As AmbiguityConfig

    ''' <summary>
    ''' Test cases per validazione
    ''' </summary>
    Public Property TestCases As List(Of String)

    Public Sub New()
        Patterns = New List(Of String)()
        PatternModes = New List(Of String)()
        TestCases = New List(Of String)()
        Ambiguity = New AmbiguityConfig()
    End Sub
End Class

''' <summary>
''' Configurazione ambiguità
''' </summary>
Public Class AmbiguityConfig
    ''' <summary>
    ''' Pattern per valori ambigui
    ''' </summary>
    Public Property AmbiguousValues As AmbiguousValuesConfig

    ''' <summary>
    ''' Lista di canonicalKey che possono essere ambigui
    ''' </summary>
    Public Property AmbiguousCanonicalKeys As List(Of String)

    Public Sub New()
        AmbiguousValues = New AmbiguousValuesConfig()
        AmbiguousCanonicalKeys = New List(Of String)()
    End Sub
End Class

''' <summary>
''' Configurazione valori ambigui
''' </summary>
Public Class AmbiguousValuesConfig
    ''' <summary>
    ''' Pattern regex che matcha valori ambigui
    ''' </summary>
    Public Property Pattern As String

    ''' <summary>
    ''' Descrizione umana dell'ambiguità
    ''' </summary>
    Public Property Description As String
End Class

''' <summary>
''' Configurazione regole
''' </summary>
Public Class RulesConfig
    ''' <summary>
    ''' Codice extractor (opzionale)
    ''' </summary>
    Public Property ExtractorCode As String

    ''' <summary>
    ''' Lista di validatori
    ''' </summary>
    Public Property Validators As List(Of Object)

    ''' <summary>
    ''' Test cases per validazione
    ''' </summary>
    Public Property TestCases As List(Of String)

    Public Sub New()
        Validators = New List(Of Object)()
        TestCases = New List(Of String)()
    End Sub
End Class

''' <summary>
''' Configurazione NER
''' </summary>
Public Class NERConfig
    ''' <summary>
    ''' Tipi di entità
    ''' </summary>
    Public Property EntityTypes As List(Of String)

    ''' <summary>
    ''' Livello di confidenza
    ''' </summary>
    Public Property Confidence As Double

    ''' <summary>
    ''' Abilitato o meno
    ''' </summary>
    Public Property Enabled As Boolean

    Public Sub New()
        EntityTypes = New List(Of String)()
        Confidence = 0.7
        Enabled = False
    End Sub
End Class

''' <summary>
''' Configurazione LLM
''' </summary>
Public Class LLMConfig
    ''' <summary>
    ''' System prompt
    ''' </summary>
    Public Property SystemPrompt As String

    ''' <summary>
    ''' User prompt template
    ''' </summary>
    Public Property UserPromptTemplate As String

    ''' <summary>
    ''' Response schema
    ''' </summary>
    Public Property ResponseSchema As Object

    ''' <summary>
    ''' Abilitato o meno
    ''' </summary>
    Public Property Enabled As Boolean

    Public Sub New()
        Enabled = False
    End Sub
End Class

