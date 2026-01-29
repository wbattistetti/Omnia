Option Strict On
Option Explicit On

Imports System
Imports Newtonsoft.Json.Linq
Imports DDTEngine

Namespace Compiler

    ''' <summary>
    ''' Helper per caricare DDTInstance da vari formati (JSON, JObject, ecc.)
    ''' Centralizza la logica di conversione: input → TaskTreeRuntime (ex AssembledDDT) → DDTInstance
    ''' </summary>
    Public Class DDTLoader

        ''' <summary>
        ''' Carica DDTInstance da un valore (JObject, JToken, o String JSON)
        ''' Converte direttamente: JSON → TaskTreeRuntime (ex AssembledDDT) → DDTInstance usando DDTCompiler
        ''' </summary>
        ''' <param name="ddtValue">Valore da convertire (String JSON, JToken, JObject)</param>
        ''' <returns>DDTInstance pronto per l'esecuzione</returns>
        ''' <exception cref="ArgumentNullException">Se ddtValue è Nothing</exception>
        ''' <exception cref="InvalidOperationException">Se il tipo non è supportato o la compilazione fallisce</exception>
        Public Shared Function LoadFromValue(ddtValue As Object) As DDTInstance
            If ddtValue Is Nothing Then
                Throw New ArgumentNullException(NameOf(ddtValue), "DDT value cannot be Nothing")
            End If

            ' Converti in stringa JSON
            Dim jsonString As String
            If TypeOf ddtValue Is String Then
                ' Se è già una stringa JSON, usala direttamente
                jsonString = CStr(ddtValue)
            ElseIf TypeOf ddtValue Is JToken Then
                ' Se è un JToken/JObject (deserializzato da Newtonsoft.Json), convertilo in stringa
                jsonString = CType(ddtValue, JToken).ToString()
            Else
                Throw New InvalidOperationException($"Tipo ddtValue non supportato: {ddtValue.GetType().Name}. Atteso: String JSON o JToken/JObject")
            End If

            Console.WriteLine($"🔄 [DDTLoader] Loading DDT from JSON ({jsonString.Length} chars)...")

            ' ✅ Usa DDTCompiler per convertire direttamente: JSON → TaskTreeRuntime → DDTInstance
            ' DDTCompiler gestisce internamente:
            ' 1. Deserializza JSON in TaskTreeRuntime (IDE format, ex AssembledDDT)
            ' 2. Converte TaskTreeRuntime in DDTInstance (Runtime format) usando DDTAssembler
            ' 3. Carica NLP contracts e valida la struttura
            Dim compiler As New DDTCompiler()
            Dim compileResult = compiler.Compile(jsonString)

            If Not compileResult.IsValid Then
                Dim errorsMessage = String.Join(", ", compileResult.ValidationErrors)
                Console.WriteLine($"❌ [DDTLoader] DDT compilation failed: {errorsMessage}")
                Throw New InvalidOperationException($"DDT compilation failed: {errorsMessage}")
            End If

            Console.WriteLine($"✅ [DDTLoader] DDT loaded successfully: {If(compileResult.Instance.MainDataList IsNot Nothing, compileResult.Instance.MainDataList.Count, 0)} mainData nodes")
            Return compileResult.Instance
        End Function

    End Class

End Namespace

