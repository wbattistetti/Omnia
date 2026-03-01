' ITaskContext.vb
' Context interface for task execution

Option Strict On
Option Explicit On

Namespace TaskEngine

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
End Interface

End Namespace
