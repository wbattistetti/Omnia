Option Strict On
Option Explicit On

Imports System
Imports Newtonsoft.Json.Linq
Imports TaskEngine

Namespace Compiler

    ''' <summary>
    ''' Helper per caricare TaskInstance da vari formati (JSON, JObject, ecc.)
    ''' Centralizza la logica di conversione: input → TaskTreeRuntime → RuntimeTask
    ''' </summary>
    Public Class TaskLoader

        ''' <summary>
        ''' Carica RuntimeTask da un valore (JObject, JToken, o String JSON)
        ''' Converte direttamente: JSON → TaskTreeRuntime → RuntimeTask usando TaskCompiler
        ''' </summary>
        ''' <param name="taskValue">Valore da convertire (String JSON, JToken, JObject)</param>
        ''' <returns>RuntimeTask pronto per l'esecuzione</returns>
        ''' <exception cref="ArgumentNullException">Se taskValue è Nothing</exception>
        ''' <exception cref="InvalidOperationException">Se il tipo non è supportato o la compilazione fallisce</exception>
        Public Shared Function LoadFromValue(taskValue As Object) As RuntimeTask
            If taskValue Is Nothing Then
                Throw New ArgumentNullException(NameOf(taskValue), "Task value cannot be Nothing")
            End If

            ' Converti in stringa JSON
            Dim jsonString As String
            If TypeOf taskValue Is String Then
                ' Se è già una stringa JSON, usala direttamente
                jsonString = CStr(taskValue)
            ElseIf TypeOf taskValue Is JToken Then
                ' Se è un JToken/JObject (deserializzato da Newtonsoft.Json), convertilo in stringa
                jsonString = CType(taskValue, JToken).ToString()
            Else
                Throw New InvalidOperationException($"Tipo taskValue non supportato: {taskValue.GetType().Name}. Atteso: String JSON o JToken/JObject")
            End If

            Console.WriteLine($"🔄 [TaskLoader] Loading Task from JSON ({jsonString.Length} chars)...")

            ' ✅ Usa TaskCompiler per convertire direttamente: JSON → TaskTreeRuntime → RuntimeTask
            ' TaskCompiler gestisce internamente:
            ' 1. Deserializza JSON in TaskTreeRuntime (IDE format)
            ' 2. Converte TaskTreeRuntime in RuntimeTask (Runtime format) usando TaskAssembler
            ' 3. Carica NLP contracts e valida la struttura
            Dim compiler As New TaskCompiler()
            Dim compileResult = compiler.Compile(jsonString)

            If Not compileResult.IsValid Then
                Dim errorsMessage = String.Join(", ", compileResult.ValidationErrors)
                Console.WriteLine($"❌ [TaskLoader] Task compilation failed: {errorsMessage}")
                Throw New InvalidOperationException($"Task compilation failed: {errorsMessage}")
            End If

            Console.WriteLine($"✅ [TaskLoader] Task loaded successfully: {If(compileResult.Task IsNot Nothing AndAlso compileResult.Task.SubTasks IsNot Nothing, compileResult.Task.SubTasks.Count, 0)} subTasks")
            Return compileResult.Task
        End Function

    End Class

End Namespace

