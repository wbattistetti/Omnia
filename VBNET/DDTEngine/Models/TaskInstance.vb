' TaskInstance.vb
' DEPRECATED: TaskInstance has been replaced by TaskUtterance.
' This file is kept temporarily to ease migration.
' Remove once all consumers are updated.

Option Strict On
Option Explicit On

''' <summary>
''' Obsolete type alias kept for backward compatibility.
''' Use TaskUtterance directly in all new code.
''' </summary>
<Obsolete("Use TaskUtterance instead.")>
Public Class TaskInstance
    Inherits TaskUtterance
End Class
