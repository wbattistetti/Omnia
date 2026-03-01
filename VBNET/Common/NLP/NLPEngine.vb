Option Strict On
Option Explicit On

''' <summary>
''' Rappresenta un singolo engine contract nell'array contracts[]
''' Questo è il nuovo modello unificato
''' </summary>
Public Class NLPEngine
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
