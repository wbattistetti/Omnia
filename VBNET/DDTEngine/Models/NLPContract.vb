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
    ''' ✅ NEW: Array di engine contracts (fonte di verità unica)
    ''' </summary>
    Public Property Contracts As List(Of NLPContractEngine)

    ''' <summary>
    ''' ❌ DEPRECATED: Usa Contracts.FirstOrDefault(Function(c) c.Type = "regex") invece
    ''' Mantenuto solo per retrocompatibilità temporanea
    ''' </summary>
    <Obsolete("Use Contracts.FirstOrDefault(Function(c) c.Type = ""regex"") instead")>
    Public Property Regex As RegexConfig

    ''' <summary>
    ''' ❌ DEPRECATED: Usa Contracts.FirstOrDefault(Function(c) c.Type = "rules") invece
    ''' </summary>
    <Obsolete("Use Contracts.FirstOrDefault(Function(c) c.Type = ""rules"") instead")>
    Public Property Rules As RulesConfig

    ''' <summary>
    ''' ❌ DEPRECATED: Usa Contracts.FirstOrDefault(Function(c) c.Type = "ner") invece
    ''' </summary>
    <Obsolete("Use Contracts.FirstOrDefault(Function(c) c.Type = ""ner"") instead")>
    Public Property Ner As NERConfig

    ''' <summary>
    ''' ❌ DEPRECATED: Usa Contracts.FirstOrDefault(Function(c) c.Type = "llm") invece
    ''' </summary>
    <Obsolete("Use Contracts.FirstOrDefault(Function(c) c.Type = ""llm"") instead")>
    Public Property Llm As LLMConfig

    Public Sub New()
        SubDataMapping = New Dictionary(Of String, SubDataMappingInfo)()
        Contracts = New List(Of NLPContractEngine)()
        ' Mantenuto per retrocompatibilità temporanea
        Regex = New RegexConfig()
        Rules = New RulesConfig()
        Ner = New NERConfig()
        Llm = New LLMConfig()
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
    ''' Pattern modes (solo per type="regex")
    ''' </summary>
    Public Property PatternModes As List(Of String)

    ''' <summary>
    ''' Ambiguity pattern (solo per type="regex")
    ''' </summary>
    Public Property AmbiguityPattern As String

    ''' <summary>
    ''' Ambiguity config (solo per type="regex")
    ''' </summary>
    Public Property Ambiguity As AmbiguityConfig

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
        PatternModes = New List(Of String)()
        TestCases = New List(Of String)()
        Validators = New List(Of Object)()
        EntityTypes = New List(Of String)()
        Confidence = 0.7
        Ambiguity = New AmbiguityConfig()
    End Sub
End Class

''' <summary>
''' Mapping info for a composite sub-field.
''' GroupName is the REQUIRED technical regex group name (format: g_[a-f0-9]{12}).
''' CanonicalKey carries semantic meaning only; Label is UI-only.
''' Neither CanonicalKey nor Label must ever appear as a regex group name.
''' </summary>
Public Class SubDataMappingInfo
    ''' <summary>
    ''' Semantic key (e.g. "day", "month", "year"). UI and domain use only.
    ''' </summary>
    Public Property CanonicalKey As String

    ''' <summary>
    ''' Required. Technical regex group name (format: g_[a-f0-9]{12}).
    ''' Sole source of truth for extraction. Must match the named group in the pattern.
    ''' </summary>
    Public Property GroupName As String

    ''' <summary>UI label only — never enters the regex.</summary>
    Public Property Label As String

    ''' <summary>Data type (e.g. "number", "text", "date").</summary>
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

