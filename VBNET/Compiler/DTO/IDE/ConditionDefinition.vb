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
    ''' Expression: contiene DSL e codice compilato
    ''' ✅ FASE 2: Nuova struttura - sostituisce data.*
    ''' </summary>
    <JsonProperty("expression")>
    Public Property Expression As ConditionExpression
End Class

''' <summary>
''' Condition Expression: contiene DSL con GUID e JavaScript compilato
''' ✅ FASE 2: Struttura semplificata - readableCode generato on-the-fly
''' </summary>
Public Class ConditionExpression
    ''' <summary>
    ''' DSL con GUID: [guid-2222] == 15 - fonte di verità
    ''' </summary>
    <JsonProperty("executableCode")>
    Public Property ExecutableCode As String

    ''' <summary>
    ''' JavaScript compilato: return ctx["guid-2222"] == 15;
    ''' </summary>
    <JsonProperty("compiledCode")>
    Public Property CompiledCode As String

    ''' <summary>
    ''' AST serializzato (opzionale, per debug)
    ''' </summary>
    <JsonProperty("ast")>
    Public Property Ast As String

    ''' <summary>
    ''' Formato: "dsl" (default)
    ''' </summary>
    <JsonProperty("format")>
    Public Property Format As String
    ' ❌ readableCode NON salvato - generato on-the-fly da executableCode + variableMappings
End Class
