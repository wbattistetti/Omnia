Option Strict On
Option Explicit On
Imports Newtonsoft.Json

''' <summary>
''' Condition Definition: rappresenta una condizione dal projectData
''' Usata per validare condizioni referenziate dagli edge durante la compilazione
''' </summary>
Public Class ConditionDefinition
    ''' <summary>
    ''' ID univoco della condizione (GUID)
    ''' </summary>
    <JsonProperty("id")>
    Public Property Id As String

    ''' <summary>
    ''' Nome della condizione (human-readable)
    ''' </summary>
    <JsonProperty("name")>
    Public Property Name As String

    ''' <summary>
    ''' Label della condizione (display name)
    ''' </summary>
    <JsonProperty("label")>
    Public Property Label As String

    ''' <summary>
    ''' Dati della condizione (script, DSL, AST)
    ''' </summary>
    <JsonProperty("data")>
    Public Property Data As ConditionData
End Class

''' <summary>
''' Condition Data: contiene script compilato e DSL originale
''' </summary>
Public Class ConditionData
    ''' <summary>
    ''' Script JavaScript compilato (execCode) - usato a runtime
    ''' </summary>
    <JsonProperty("script")>
    Public Property Script As String

    ''' <summary>
    ''' Codice DSL originale (uiCode) - usato per validazione
    ''' </summary>
    <JsonProperty("uiCode")>
    Public Property UiCode As String

    ''' <summary>
    ''' Formato del codice UI ("dsl" o altro)
    ''' </summary>
    <JsonProperty("uiCodeFormat")>
    Public Property UiCodeFormat As String

    ''' <summary>
    ''' AST serializzato (opzionale, per debug)
    ''' </summary>
    <JsonProperty("ast")>
    Public Property Ast As String
End Class
