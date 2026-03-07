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
    ''' Critical: Blocks compilation result usage (orchestrator must reject)
    ''' </summary>
    Critical = 2
    End Enum
