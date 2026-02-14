Option Strict On
Option Explicit On

Imports ApiServer.Models

''' <summary>
''' Request validation utilities
''' </summary>
Namespace Validators

    ''' <summary>
    ''' ✅ STATELESS: Validates that the TaskSessionStartRequest contains all required fields (projectId, dialogVersion, locale).
    ''' </summary>
    ''' <param name="request">The request object to validate.</param>
    ''' <returns>A tuple containing: (IsValid As Boolean, ErrorMessage As String)</returns>
    Public Module RequestValidators

        Public Function ValidateRequest(request As TaskSessionStartRequest) As (IsValid As Boolean, ErrorMessage As String)
            If request Is Nothing Then
                Return (False, "Request object is null. Expected a valid TaskSessionStartRequest with projectId, dialogVersion, and locale.")
            End If

            If String.IsNullOrEmpty(request.ProjectId) Then
                Return (False, "ProjectId is missing or empty. The request must include a valid projectId field.")
            End If

            If String.IsNullOrEmpty(request.DialogVersion) Then
                Return (False, "DialogVersion is missing or empty. The request must include a valid dialogVersion field.")
            End If

            If String.IsNullOrEmpty(request.Locale) Then
                Return (False, "Locale is missing or empty. The request must include a valid locale field.")
            End If

            Return (True, Nothing)
        End Function

        ''' <summary>
        ''' Validates that a task is of type UtteranceInterpretation, which is required for task session compilation.
        ''' </summary>
        ''' <param name="task">The task to validate.</param>
        ''' <returns>A tuple containing: (IsValid As Boolean, ErrorMessage As String)</returns>
        Public Function ValidateTaskType(task As Compiler.Task) As (IsValid As Boolean, ErrorMessage As String)
            If task Is Nothing Then
                Return (False, "Task object is null. Cannot validate task type.")
            End If

            If Not task.Type.HasValue Then
                Return (False, $"Task with ID '{task.Id}' has no type specified. Expected type: UtteranceInterpretation.")
            End If

            If task.Type.Value <> TaskEngine.TaskTypes.UtteranceInterpretation Then
                Dim actualType = task.Type.Value.ToString()
                Return (False, $"Task with ID '{task.Id}' has type '{actualType}', but expected type 'UtteranceInterpretation'. Only UtteranceInterpretation tasks can be compiled into task sessions.")
            End If

            Return (True, Nothing)
        End Function

    End Module

End Namespace
