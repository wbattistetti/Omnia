Option Strict On
Option Explicit On

''' <summary>
''' Interfaccia comune per task che possono essere parsati dal Parser
''' ✅ Risolve dipendenza circolare: DDTEngine non ha bisogno di riferire Compiler
''' </summary>
Public Interface IParsableTask
    ''' <summary>
    ''' Task ID (GUID)
    ''' </summary>
    ReadOnly Property Id As String

    ''' <summary>
    ''' NLP Contract per l'estrazione dati
    ''' </summary>
    ReadOnly Property NlpContract As CompiledNlpContract

    ''' <summary>
    ''' Sub-tasks (se il task è composito)
    ''' </summary>
    ReadOnly Property SubTasks As List(Of IParsableTask)

    ''' <summary>
    ''' Verifica se il task ha sub-tasks
    ''' </summary>
    Function HasSubTasks() As Boolean
End Interface
