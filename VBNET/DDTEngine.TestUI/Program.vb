' Program.vb
' Entry point per l'applicazione di test

Option Strict On
Option Explicit On

Imports System.Windows.Forms

Namespace TaskEngine.TestUI

    Module Program
        ''' <summary>
        ''' Entry point principale
        ''' </summary>
        <STAThread()>
        Sub Main()
            Application.EnableVisualStyles()
            Application.SetCompatibleTextRenderingDefault(False)
            Application.Run(New MainForm())
        End Sub
    End Module

End Namespace










































