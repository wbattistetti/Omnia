Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports TaskEngine

''' <summary>
''' RuntimeTask: Struttura runtime ricorsiva per esecuzione
''' Ogni RuntimeTask può contenere altri RuntimeTask (subTasks)
''' Completamente materializzato dal compilatore, senza riferimenti esterni
''' </summary>
Public Class RuntimeTask
    ''' <summary>
    ''' ID univoco del task
    ''' </summary>
    Public Property Id As String

    ''' <summary>
    ''' Condizione di esecuzione (opzionale)
    ''' Se presente, il task viene eseguito solo se la condizione è vera
    ''' </summary>
    Public Property Condition As Condition

    ''' <summary>
    ''' Steps di dialogo (solo se il task è atomico o aggregato)
    ''' Provengono SOLO dall'istanza, non dal template
    ''' </summary>
    Public Property Steps As List(Of TaskEngine.DialogueStep)

    ''' <summary>
    ''' Constraints per validazione input
    ''' Provengono dal template
    ''' </summary>
    Public Property Constraints As List(Of ValidationCondition)

    ''' <summary>
    ''' NLP Contract per match/retrieval/interpretazione input
    ''' Opzionale, ma necessario per task che richiedono estrazione dati
    ''' </summary>
    Public Property NlpContract As CompiledNlpContract

    ''' <summary>
    ''' Lista di RuntimeTask figli (ricorsivo)
    ''' Ogni figlio è un RuntimeTask completo, materializzato
    ''' </summary>
    Public Property SubTasks As List(Of RuntimeTask)

    Public Sub New()
        Steps = New List(Of TaskEngine.DialogueStep)()
        Constraints = New List(Of ValidationCondition)()
        ' ✅ SubTasks inizializzato solo quando necessario (lazy initialization)
        SubTasks = Nothing
    End Sub

    ''' <summary>
    ''' Verifica se il task ha subTasks
    ''' </summary>
    Public Function HasSubTasks() As Boolean
        Return SubTasks IsNot Nothing AndAlso SubTasks.Count > 0
    End Function

    ''' <summary>
    ''' Verifica se il task è atomico (ha steps ma non subTasks)
    ''' </summary>
    Public Function IsAtomic() As Boolean
        Return Steps IsNot Nothing AndAlso Steps.Count > 0 AndAlso (SubTasks Is Nothing OrElse SubTasks.Count = 0)
    End Function

    ''' <summary>
    ''' Verifica se il task è composto (ha subTasks ma non steps)
    ''' </summary>
    Public Function IsComposite() As Boolean
        Return HasSubTasks() AndAlso (Steps Is Nothing OrElse Steps.Count = 0)
    End Function

    ''' <summary>
    ''' Verifica se il task è aggregato (ha sia steps che subTasks)
    ''' </summary>
    Public Function IsAggregate() As Boolean
        Return HasSubTasks() AndAlso Steps IsNot Nothing AndAlso Steps.Count > 0
    End Function
End Class
