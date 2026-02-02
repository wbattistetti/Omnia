Option Strict On
Option Explicit On
Imports Compiler

''' <summary>
''' Converter utilities for RuntimeTask transformations
''' </summary>
Namespace Converters

    ''' <summary>
    ''' Converte CompiledUtteranceTask in RuntimeTask (helper temporaneo)
    ''' TODO: Aggiornare SessionManager per accettare direttamente CompiledUtteranceTask
    ''' </summary>
    Public Module RuntimeTaskConverter

        Public Function ConvertCompiledToRuntimeTask(compiled As Compiler.CompiledUtteranceTask) As Compiler.RuntimeTask
            Console.WriteLine($"🔍 [ConvertCompiledToRuntimeTask] START")
            Console.WriteLine($"   compiled.Id: {compiled.Id}")
            Console.WriteLine($"   compiled.Steps.Count: {If(compiled.Steps IsNot Nothing, compiled.Steps.Count, 0)}")
            Console.WriteLine($"   compiled.HasSubTasks: {compiled.HasSubTasks()}")
            Dim runtimeTask As New Compiler.RuntimeTask() With {
                .Id = compiled.Id,
                .Condition = compiled.Condition,
                .Steps = compiled.Steps,
                .Constraints = compiled.Constraints,
                .NlpContract = compiled.NlpContract
            }

            ' ✅ Copia SubTasks ricorsivamente (solo se presenti)
            If compiled.HasSubTasks() Then
                Console.WriteLine($"🔍 [ConvertCompiledToRuntimeTask] Copying {compiled.SubTasks.Count} SubTasks...")
                runtimeTask.SubTasks = New List(Of Compiler.RuntimeTask)()
                For Each subCompiled As Compiler.CompiledUtteranceTask In compiled.SubTasks
                    runtimeTask.SubTasks.Add(ConvertCompiledToRuntimeTask(subCompiled))
                Next
                Console.WriteLine($"✅ [ConvertCompiledToRuntimeTask] Copied {runtimeTask.SubTasks.Count} SubTasks")
            Else
                Console.WriteLine($"🔍 [ConvertCompiledToRuntimeTask] No SubTasks (atomic task)")
            End If

            Console.WriteLine($"✅ [ConvertCompiledToRuntimeTask] END - Created RuntimeTask with Id={runtimeTask.Id}")
            Return runtimeTask
        End Function

        ''' <summary>
        ''' ✅ Helper: Converte RuntimeTask in CompiledUtteranceTask (ricorsivo)
        ''' </summary>
        Public Function ConvertRuntimeTaskToCompiledUtteranceTask(runtimeTask As Compiler.RuntimeTask) As Compiler.CompiledUtteranceTask
            Dim compiled As New Compiler.CompiledUtteranceTask() With {
                .Id = runtimeTask.Id,
                .Condition = runtimeTask.Condition,
                .Steps = runtimeTask.Steps,
                .Constraints = runtimeTask.Constraints,
                .NlpContract = runtimeTask.NlpContract
            }

            ' ✅ Copia SubTasks ricorsivamente (solo se presenti)
            If runtimeTask.HasSubTasks() Then
                compiled.SubTasks = New List(Of Compiler.CompiledUtteranceTask)()
                For Each subTask As Compiler.RuntimeTask In runtimeTask.SubTasks
                    compiled.SubTasks.Add(ConvertRuntimeTaskToCompiledUtteranceTask(subTask))
                Next
            Else
                compiled.SubTasks = Nothing
            End If

            Return compiled
        End Function

    End Module

End Namespace
