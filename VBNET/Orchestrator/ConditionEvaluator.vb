Option Strict On
Option Explicit On
Imports Compiler
Imports Compiler.DTO.Runtime
Imports Common.DSL
Imports System.Text.Json

''' <summary>
''' Valuta condizioni per determinare quale task eseguire
'''
''' Implementa short-circuit per AND/OR:
''' - AND: valuta da sinistra a destra, ferma al primo False
''' - OR: valuta da sinistra a destra, ferma al primo True
''' </summary>
Public Class ConditionEvaluator
    ''' <summary>
    ''' Condition loader - can be set to provide condition loading from repository
    ''' If Nothing, EdgeCondition evaluation will return False
    ''' </summary>
    Public Shared Property ConditionLoader As IConditionLoader
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
                ' Valuta condizione di un edge (link) usando DSL interpreter
                Dim conditionId = condition.EdgeConditionId
                If String.IsNullOrEmpty(conditionId) Then
                    Return False
                End If
                Return EvaluateEdgeConditionDSL(conditionId, state.VariableStore)

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

    ''' <summary>
    ''' Evaluates EdgeCondition using DSL interpreter
    ''' Loads AST from condition repository and evaluates it
    ''' </summary>
    Private Shared Function EvaluateEdgeConditionDSL(
        conditionId As String,
        variableStore As Dictionary(Of String, Object)
    ) As Boolean
        Try
            ' Check if condition loader is available
            If ConditionLoader Is Nothing Then
                Console.WriteLine($"[ConditionEvaluator] ⚠️ ConditionLoader not set, cannot evaluate EdgeCondition {conditionId}")
                Return False
            End If

            ' Load condition data from repository
            Dim conditionData = ConditionLoader.LoadCondition(conditionId)
            If conditionData Is Nothing Then
                Console.WriteLine($"[ConditionEvaluator] ⚠️ Condition {conditionId} not found in repository")
                Return False
            End If

            ' Get AST JSON from condition data
            Dim astJson As String = Nothing
            If conditionData.ContainsKey("ast") AndAlso conditionData("ast") IsNot Nothing Then
                astJson = conditionData("ast").ToString()
            End If

            If String.IsNullOrEmpty(astJson) Then
                Console.WriteLine($"[ConditionEvaluator] ⚠️ Condition {conditionId} has no AST data")
                Return False
            End If

            ' Deserialize AST
            Dim options = New JsonSerializerOptions() With {
                .PropertyNameCaseInsensitive = True,
                .AllowTrailingCommas = True,
                .ReadCommentHandling = JsonCommentHandling.Skip
            }

            ' Log the JSON string being deserialized
            Console.WriteLine($"[ConditionEvaluator] 🔍 Deserializing AST for condition {conditionId}")
            Console.WriteLine($"[ConditionEvaluator]   JSON length: {If(astJson, "").Length}")
            If Not String.IsNullOrEmpty(astJson) Then
                Dim previewLength = Math.Min(200, astJson.Length)
                Console.WriteLine($"[ConditionEvaluator]   JSON preview: {astJson.Substring(0, previewLength)}{If(astJson.Length > 200, "...", "")}")
            End If

            Dim ast As ASTNode = Nothing
            Try
                ast = JsonSerializer.Deserialize(Of ASTNode)(astJson, options)
            Catch deserEx As Exception
                Console.WriteLine($"[ConditionEvaluator] ❌ Deserialization exception for condition {conditionId}: {deserEx.Message}")
                Console.WriteLine($"[ConditionEvaluator]   Inner exception: {If(deserEx.InnerException IsNot Nothing, deserEx.InnerException.Message, "None")}")
                Console.WriteLine($"[ConditionEvaluator]   Stack trace: {deserEx.StackTrace}")
                Return False
            End Try

            If ast Is Nothing Then
                Console.WriteLine($"[ConditionEvaluator] ⚠️ Failed to deserialize AST for condition {conditionId} - ast is Nothing")
                Return False
            End If

            Console.WriteLine($"[ConditionEvaluator] ✅ AST deserialized successfully: type={ast.Type}, hasLeft={ast.Left IsNot Nothing}, hasRight={ast.Right IsNot Nothing}, hasArgs={ast.Args IsNot Nothing AndAlso ast.Args.Count > 0}")

            ' Evaluate using interpreter
            Dim interpreter = New DSLInterpreter(variableStore)
            Dim result = interpreter.Evaluate(ast)

            Console.WriteLine($"[ConditionEvaluator] ✅ DSL condition {conditionId} evaluated: {result}")
            Return result

        Catch ex As Exception
            Console.WriteLine($"[ConditionEvaluator] ❌ Error evaluating DSL condition {conditionId}: {ex.Message}")
            Console.WriteLine($"[ConditionEvaluator]   Stack trace: {ex.StackTrace}")
            Return False
        End Try
    End Function

    ''' <summary>
    ''' Valuta TaskGroupExecCondition (nuova struttura semplificata)
    ''' Valuta TUTTE le EdgeCondition (no early exit) per rilevare ambiguità
    ''' </summary>
    ''' <param name="execCondition">Condizione di esecuzione del TaskGroup</param>
    ''' <param name="state">Stato di esecuzione</param>
    ''' <param name="taskGroupId">ID del TaskGroup (per entry node: verifica che non sia già eseguito)</param>
    Public Shared Function EvaluateTaskGroupExecCondition(
        execCondition As TaskGroupExecCondition,
        state As ExecutionState,
        Optional taskGroupId As String = Nothing
    ) As Boolean
        If execCondition Is Nothing OrElse execCondition.EdgeConditions Is Nothing OrElse execCondition.EdgeConditions.Count = 0 Then
            ' Entry node: eseguibile solo se non già eseguito
            If Not String.IsNullOrEmpty(taskGroupId) Then
                Dim isExecuted = state.ExecutedTaskGroupIds.Contains(taskGroupId)
                Console.WriteLine($"[ConditionEvaluator] 🔍 Entry node {taskGroupId}: Executed={isExecuted}")
                Return Not isExecuted
            End If
            ' Nessuna condizione = sempre eseguibile
            Return True
        End If

        ' ✅ Valuta TUTTE le EdgeCondition (no early exit per rilevare ambiguità)
        Dim trueConditions As New List(Of EdgeCondition)()
        Dim elseCondition As EdgeCondition = Nothing

        For Each edgeCond In execCondition.EdgeConditions
            Dim isTrue = EvaluateEdgeCondition(edgeCond, state)

            If edgeCond.IsElse Then
                elseCondition = edgeCond
            ElseIf isTrue Then
                trueConditions.Add(edgeCond)
            End If
        Next

        ' ✅ ERRORE: Multiple condizioni true contemporaneamente (ambiguità)
        If trueConditions.Count > 1 Then
            Dim edgeIds = String.Join(", ", trueConditions.Select(Function(c) c.EdgeId))
            Dim errorMsg = $"Ambiguous ExecCondition: {trueConditions.Count} conditions are true simultaneously. " &
                          $"Only one condition should be true at a time. Edge IDs: {edgeIds}"
            Console.WriteLine($"[ConditionEvaluator] ❌ {errorMsg}")
            Throw New InvalidOperationException(errorMsg)
        End If

        ' ✅ Se esattamente una è true → TaskGroup può essere eseguito
        If trueConditions.Count = 1 Then
            Console.WriteLine($"[ConditionEvaluator] ✅ ExecCondition satisfied by edge {trueConditions(0).EdgeId}")
            Return True
        End If

        ' ✅ Se nessuna è true E c'è Else → attiva Else
        If trueConditions.Count = 0 AndAlso elseCondition IsNot Nothing Then
            ' Verifica che il TaskGroup sorgente dell'Else sia completato
            If EvaluateTaskGroupCompleted(elseCondition.TaskGroupId, state) Then
                Console.WriteLine($"[ConditionEvaluator] ✅ ExecCondition satisfied by Else edge {elseCondition.EdgeId}")
                Return True
            End If
        End If

        ' ✅ Altrimenti → TaskGroup non può essere eseguito
        Console.WriteLine($"[ConditionEvaluator] ⚠️ ExecCondition not satisfied: {trueConditions.Count} true conditions, Else={elseCondition IsNot Nothing}")
        Return False
    End Function

    ''' <summary>
    ''' Valuta una singola EdgeCondition
    ''' EdgeCondition è vera se: TaskGroup(TaskGroupId).completed AND Expression=true
    ''' </summary>
    Private Shared Function EvaluateEdgeCondition(
        edgeCond As EdgeCondition,
        state As ExecutionState
    ) As Boolean
        ' 1. Verifica se TaskGroup sorgente è completato
        Dim sourceCompleted = EvaluateTaskGroupCompleted(edgeCond.TaskGroupId, state)
        If Not sourceCompleted Then
            Return False
        End If

        ' 2. Se Expression è vuota, considera solo TaskGroupId.completed
        If String.IsNullOrEmpty(edgeCond.Expression) Then
            Return True
        End If

        ' 3. Valuta Expression usando DSLInterpreter
        Try
            Dim options = New JsonSerializerOptions() With {
                .PropertyNameCaseInsensitive = True,
                .AllowTrailingCommas = True,
                .ReadCommentHandling = JsonCommentHandling.Skip
            }

            ' Log the JSON string being deserialized
            Console.WriteLine($"[ConditionEvaluator] 🔍 Deserializing AST for edge {edgeCond.EdgeId}")
            Console.WriteLine($"[ConditionEvaluator]   JSON length: {If(edgeCond.Expression, "").Length}")
            If Not String.IsNullOrEmpty(edgeCond.Expression) Then
                Dim previewLength = Math.Min(200, edgeCond.Expression.Length)
                Console.WriteLine($"[ConditionEvaluator]   JSON preview: {edgeCond.Expression.Substring(0, previewLength)}{If(edgeCond.Expression.Length > 200, "...", "")}")
            End If

            Dim ast As ASTNode = Nothing
            Try
                ast = JsonSerializer.Deserialize(Of ASTNode)(edgeCond.Expression, options)
            Catch deserEx As Exception
                Console.WriteLine($"[ConditionEvaluator] ❌ Deserialization exception for edge {edgeCond.EdgeId}: {deserEx.Message}")
                Console.WriteLine($"[ConditionEvaluator]   Inner exception: {If(deserEx.InnerException IsNot Nothing, deserEx.InnerException.Message, "None")}")
                Console.WriteLine($"[ConditionEvaluator]   Stack trace: {deserEx.StackTrace}")
                Return False
            End Try

            If ast Is Nothing Then
                Console.WriteLine($"[ConditionEvaluator] ⚠️ Failed to deserialize AST for edge {edgeCond.EdgeId} - ast is Nothing")
                Return False
            End If

            Console.WriteLine($"[ConditionEvaluator] ✅ AST deserialized successfully: type={ast.Type}, hasLeft={ast.Left IsNot Nothing}, hasRight={ast.Right IsNot Nothing}, hasArgs={ast.Args IsNot Nothing AndAlso ast.Args.Count > 0}")

            Dim interpreter = New DSLInterpreter(state.VariableStore)
            Dim expressionResult = interpreter.Evaluate(ast)

            Console.WriteLine($"[ConditionEvaluator] 🔍 Edge {edgeCond.EdgeId}: TaskGroup {edgeCond.TaskGroupId} completed={sourceCompleted}, Expression={expressionResult}")
            Return expressionResult

        Catch ex As Exception
            Console.WriteLine($"[ConditionEvaluator] ❌ Error evaluating expression for edge {edgeCond.EdgeId}: {ex.Message}")
            Console.WriteLine($"[ConditionEvaluator]   Stack trace: {ex.StackTrace}")
            Return False
        End Try
    End Function

    ''' <summary>
    ''' Verifica se un TaskGroup è stato completato
    ''' </summary>
    Private Shared Function EvaluateTaskGroupCompleted(
        taskGroupId As String,
        state As ExecutionState
    ) As Boolean
        If String.IsNullOrEmpty(taskGroupId) Then
            Return False
        End If
        Return state.ExecutedTaskGroupIds.Contains(taskGroupId)
    End Function
End Class

