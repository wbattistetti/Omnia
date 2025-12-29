Option Strict On
Option Explicit On

''' <summary>
''' Rappresenta un nodo del DDT (mainData o subData) - Struttura Runtime
''' Contiene sia i campi design-time (dal frontend MainDataNode) che i campi runtime
''' </summary>
Public Class DDTNode
    ' ============================================================
    ' CAMPI DESIGN-TIME (dal frontend MainDataNode)
    ' ============================================================

    ''' <summary>
    ''' ID univoco del nodo
    ''' </summary>
    Public Property Id As String

    ''' <summary>
    ''' Nome del dato (es. "Nome", "Cognome", "Indirizzo")
    ''' </summary>
    Public Property Name As String

    ''' <summary>
    ''' Label leggibile del nodo
    ''' </summary>
    Public Property Label As String

    ''' <summary>
    ''' Tipo di dato (es. "date", "email", "text")
    ''' </summary>
    Public Property Type As String

    ''' <summary>
    ''' Condizione di attivazione del nodo
    ''' </summary>
    Public Property Condition As String

    ''' <summary>
    ''' Sinonimi per il riconoscimento NLP
    ''' </summary>
    Public Property Synonyms As List(Of String)

    ''' <summary>
    ''' Constraints di validazione
    ''' </summary>
    Public Property Constraints As List(Of Object)

    Public Property Required As Boolean

    Public Property SubData As List(Of DDTNode)

    ' ============================================================
    ' CAMPI RUNTIME (calcolati/usati durante esecuzione)
    ' ============================================================

    ''' <summary>
    ''' FullLabel: path completo dall'ancestor root alla leaf (es. "Nominativo.Nome")
    ''' Calcolato a compile-time quando il DDT viene caricato
    ''' </summary>
    Public Property FullLabel As String

    Public Property Steps As List(Of DialogueStep)

    Public Property ValidationConditions As List(Of ValidationCondition)

    Public Property ParentData As DDTNode

    Public Property RequiresConfirmation As Boolean

    Public Property RequiresValidation As Boolean

    Public Property State As DialogueState

    Public Property Value As Object

    ''' <summary>
    ''' ID della condizione di validazione fallita (se state = "invalid")
    ''' </summary>
    Public Property InvalidConditionId As String

    ''' <summary>
    ''' NLP Contract pre-compilato per l'estrazione dati (regex patterns, mapping, ecc.)
    ''' Caricato e pre-compilato a compile-time dal compiler
    ''' </summary>
    Public Property NlpContract As CompiledNlpContract

    Public Sub New()
        Synonyms = New List(Of String)()
        Constraints = New List(Of Object)()
        Steps = New List(Of DialogueStep)()
        ValidationConditions = New List(Of ValidationCondition)()
        SubData = New List(Of DDTNode)()
        State = DialogueState.Start
        Value = Nothing
    End Sub

    ''' <summary>
    ''' Resetta lo stato del nodo e dei suoi subData
    ''' </summary>
    Public Sub Reset()
        State = DialogueState.Start
        Value = Nothing
        InvalidConditionId = Nothing

        ' Resetta anche tutti i subData
        If SubData IsNot Nothing Then
            For Each subNode As DDTNode In SubData
                subNode.Reset()
            Next
        End If
    End Sub

    ''' <summary>
    ''' Verifica se il nodo ha subData
    ''' </summary>
    Public Function HasSubData() As Boolean
        Return SubData IsNot Nothing AndAlso SubData.Count > 0
    End Function

    ''' <summary>
    ''' Verifica se il nodo è composito
    ''' </summary>
    Public Function IsComposite() As Boolean
        Return HasSubData()
    End Function
End Class

