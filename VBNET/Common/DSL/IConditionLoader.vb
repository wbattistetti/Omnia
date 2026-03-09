Option Strict On
Option Explicit On

''' <summary>
''' Interface for loading condition data from repository/database
''' Implement this to provide condition loading functionality
''' </summary>
Public Interface IConditionLoader
    ''' <summary>
    ''' Loads condition data by condition ID
    ''' Returns condition data dictionary or Nothing if not found
    ''' Expected structure: { "ast": "...", "uiCode": "...", "execCode": "..." }
    ''' </summary>
    Function LoadCondition(conditionId As String) As Dictionary(Of String, Object)
End Interface
