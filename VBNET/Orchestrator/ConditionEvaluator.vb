Option Strict On
Option Explicit On
Imports Compiler

''' <summary>
''' Valuta condizioni per determinare quale task eseguire
'''
''' Implementa short-circuit per AND/OR:
''' - AND: valuta da sinistra a destra, ferma al primo False
''' - OR: valuta da sinistra a destra, ferma al primo True
''' </summary>
Public Class ConditionEvaluator
    ''' <summary>
    ''' Valuta una condizione e ritorna True se soddisfatta
    ''' Funzione deterministica: stesso input → stesso output
    ''' </summary>
    Public Shared Function EvaluateCondition(condition As Condition, state As ExecutionState) As Boolean
        If condition Is Nothing Then
            Return True  ' Nessuna condizione = sempre eseguibile
        End If

        Select Case condition.Type
            Case ConditionType.Always
                Return True

            Case ConditionType.TaskGroupExecuted
                ' Verifica se TaskGroup è stato eseguito
                If String.IsNullOrEmpty(condition.NodeId) Then
                    Return False
                End If
                Return state.ExecutedTaskGroupIds.Contains(condition.NodeId)

            Case ConditionType.TaskState
                ' Verifica stato di un task specifico
                If String.IsNullOrEmpty(condition.TaskId) Then
                    Return False
                End If
                If Not condition.State.HasValue Then
                    Return False
                End If
                ' Verifica se task è stato eseguito e ha lo stato richiesto
                If Not state.ExecutedTaskIds.Contains(condition.TaskId) Then
                    Return False
                End If
                ' TODO: Verificare stato specifico del task (richiede estensione ExecutionState)
                Return True  ' Per ora assume che se eseguito, stato è corretto

            Case ConditionType.EdgeCondition
                ' Valuta condizione di un edge (link)
                ' TODO: Implementare valutazione EdgeCondition
                ' Per ora assume sempre True
                Return True

            Case ConditionType.AndOp
                ' ✅ SHORT-CIRCUIT: valuta da sinistra a destra, ferma al primo False
                If condition.Conditions Is Nothing OrElse condition.Conditions.Count = 0 Then
                    Return True
                End If
                For Each subCondition In condition.Conditions
                    If Not EvaluateCondition(subCondition, state) Then
                        Return False  ' Short-circuit: non valuta resto
                    End If
                Next
                Return True

            Case ConditionType.OrOp
                ' ✅ SHORT-CIRCUIT: valuta da sinistra a destra, ferma al primo True
                If condition.Conditions Is Nothing OrElse condition.Conditions.Count = 0 Then
                    Return False
                End If
                For Each subCondition In condition.Conditions
                    If EvaluateCondition(subCondition, state) Then
                        Return True  ' Short-circuit: non valuta resto
                    End If
                Next
                Return False

            Case ConditionType.NotOp
                If condition.Condition Is Nothing Then
                    Return True  ' NOT Nothing = True
                End If
                Return Not EvaluateCondition(condition.Condition, state)

            Case Else
                Console.WriteLine($"[ConditionEvaluator] ⚠️ Unknown condition type: {condition.Type}")
                Return False
        End Select
    End Function
End Class

