Option Strict On
Option Explicit On

''' <summary>
''' Rappresenta un nodo del DDT (mainData o subData) - Struttura Runtime
''' Contiene solo i campi necessari per l'esecuzione runtime
''' I campi design-time (Label, Type, Synonyms, Constraints, Condition) sono rimossi
''' perché non utilizzati durante l'esecuzione
''' </summary>
Public Class DDTNode
    ' ============================================================
    ' CAMPI RUNTIME ESSENZIALI
    ' ============================================================

    ''' <summary>
    ''' ID univoco del nodo
    ''' </summary>
    Public Property Id As String

    ''' <summary>
    ''' Nome del dato (es. "Nome", "Cognome", "Indirizzo")
    ''' Usato per fallback regex hardcoded in Parser.vb
    ''' </summary>
    Public Property Name As String

    ''' <summary>
    ''' Indica se il dato è obbligatorio
    ''' </summary>
    Public Property Required As Boolean

    ''' <summary>
    ''' Lista di subData (per nodi compositi)
    ''' </summary>
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

