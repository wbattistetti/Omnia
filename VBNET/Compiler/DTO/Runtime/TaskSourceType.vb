Option Strict On
Option Explicit On

''' <summary>
''' Task source type: origine del task durante l'esecuzione
''' Tipi del mondo Runtime - usati durante l'esecuzione
''' </summary>
Public Enum TaskSourceType
    ''' <summary>
    ''' Task da un nodo del flowchart
    ''' </summary>
    Flowchart = 1

    ''' <summary>
    ''' Task da uno step del DDT
    ''' </summary>
    DDTStep = 2

    ''' <summary>
    ''' Task da un'azione di recovery del DDT
    ''' </summary>
    DDTRecoveryAction = 3
End Enum


