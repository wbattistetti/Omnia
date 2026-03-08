Option Strict On
Option Explicit On
Imports Newtonsoft.Json
Imports Newtonsoft.Json.Converters

''' <summary>
''' Error severity levels for compilation errors
''' </summary>
<JsonConverter(GetType(StringEnumConverter))>
    Public Enum ErrorSeverity
    ''' <summary>
    ''' Error: Blocks orchestrator execution but allows partial compilation
    ''' </summary>
    [Error] = 0

    ''' <summary>
    ''' Warning: Does not block anything, only visualization
    ''' </summary>
    Warning = 1

    ''' <summary>
    ''' Hint: Future use for design suggestions (not used now)
    ''' </summary>
    Hint = 2
    End Enum
