' ITaskContext.vb
' Context interface for task execution

Option Strict On
Option Explicit On

''' <summary>
''' Provides context information for task execution
''' Allows ITask to be independent of specific Engine types
''' </summary>
Public Interface ITaskContext
    ''' <summary>
    ''' Project ID for translation resolution
    ''' </summary>
    ReadOnly Property ProjectId As String

    ''' <summary>
    ''' Locale for translation resolution
    ''' </summary>
    ReadOnly Property Locale As String

    ''' <summary>
    ''' Translation resolver for message localization
    ''' </summary>
    ReadOnly Property TranslationResolver As Object ' Using Object to avoid dependency on Engine.Interfaces.ITranslationResolver

    ''' <summary>
    ''' Runtime variable values keyed by varId (GUID). Message placeholders must use [guid] tokens matching these keys.
    ''' When set, <see cref="MessageTask"/> resolves placeholders via the same VariableStore lookup as FlowOrchestrator.
    ''' When Nothing, MessageTask falls back to label-based resolution on the TaskUtterance tree (legacy).
    ''' </summary>
    ReadOnly Property VariableStore As Dictionary(Of String, Object)
End Interface
