Option Strict On
Option Explicit On

''' <summary>
''' Mapping info for a composite sub-field.
''' GroupName is the REQUIRED technical regex group name (format: s[0-9]+ or g_[a-f0-9]{12}).
''' Label is required and used for UI display only.
''' Neither Label nor any semantic name must ever appear as a regex group name.
''' </summary>
Public Class SubDataMappingInfo
    ''' <summary>
    ''' Required. Technical regex group name (format: s[0-9]+ or g_[a-f0-9]{12}).
    ''' Sole source of truth for extraction. Must match the named group in the pattern.
    ''' </summary>
    Public Property GroupName As String

    ''' <summary>Required. UI label — never enters the regex.</summary>
    Public Property Label As String

    ''' <summary>Data type (e.g. "number", "text", "date").</summary>
    Public Property Type As String

    ''' <summary>
    ''' Indice del pattern da usare (per context-aware extraction)
    ''' </summary>
    Public Property PatternIndex As Integer?
End Class
