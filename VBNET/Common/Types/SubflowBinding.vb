Option Strict On
Option Explicit On

Imports Newtonsoft.Json

''' <summary>
''' Policy S2: mapping obbligatorio tra parametro interfaccia child e variabile parent.
''' <c>interfaceParameterId</c> = chiave child (variableRefId output); <c>parentVariableId</c> = variabile parent.
''' Le due stringhe possono coincidere se il GUID è condiviso dopo il move; il mapping resta esplicito.
''' </summary>
Public Class SubflowBinding
    <JsonProperty("interfaceParameterId")>
    Public Property InterfaceParameterId As String

    <JsonProperty("parentVariableId")>
    Public Property ParentVariableId As String
End Class
