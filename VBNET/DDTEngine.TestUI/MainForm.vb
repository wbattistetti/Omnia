' MainForm.vb
' Form principale per testare il DDT Engine con interfaccia chat

Option Strict On
Option Explicit On

Imports System.Drawing
Imports System.IO
Imports System.Threading
Imports System.Windows.Forms
Imports TaskEngine

Namespace TaskEngine.TestUI

    ''' <summary>
    ''' Form principale con interfaccia chat per testare il DDT Engine
    ''' </summary>
    Public Class MainForm
        Inherits Form

        ' Usa il nome completamente qualificato con Global per evitare ambiguit�
        Private ReadOnly _engine As Motore
        Private _chatArea As TextBox
        Private WithEvents _inputBox As TextBox
        Private _sendButton As Button
        Private _stateViewer As ListBox
        Friend WithEvents CmdRestart As Button
        Private _taskInstance As Global.TaskEngine.TaskInstance
        Private _engineThread As Thread
        Private _isEngineRunning As Boolean = False

        Public Sub New()
            _engine = New Global.TaskEngine.Motore()
            InitializeComponent()

            ' Aggancia gli eventi del Motore
            AddHandler _engine.MessageToShow, AddressOf OnMessageToShow

            'LoadTestDDT()
        End Sub

        Private Sub InitializeComponent()
            _chatArea = New TextBox()
            _inputBox = New TextBox()
            _sendButton = New Button()
            _stateViewer = New ListBox()
            CmdRestart = New Button()
            SuspendLayout()
            '
            ' _chatArea
            '
            _chatArea.Anchor = AnchorStyles.Top Or AnchorStyles.Bottom Or AnchorStyles.Left Or AnchorStyles.Right
            _chatArea.BackColor = Color.Black
            _chatArea.ForeColor = Color.White
            _chatArea.Location = New Point(383, 39)
            _chatArea.Multiline = True
            _chatArea.Name = "_chatArea"
            _chatArea.Size = New Size(669, 428)
            _chatArea.TabIndex = 0
            '
            ' _inputBox
            '
            _inputBox.Anchor = AnchorStyles.Bottom Or AnchorStyles.Left Or AnchorStyles.Right
            _inputBox.BackColor = Color.Black
            _inputBox.ForeColor = Color.White
            _inputBox.Location = New Point(383, 473)
            _inputBox.Name = "_inputBox"
            _inputBox.Size = New Size(588, 27)
            _inputBox.TabIndex = 0
            '
            ' _sendButton
            '
            _sendButton.Anchor = AnchorStyles.Bottom Or AnchorStyles.Right
            _sendButton.Location = New Point(977, 473)
            _sendButton.Name = "_sendButton"
            _sendButton.Size = New Size(75, 29)
            _sendButton.TabIndex = 1
            _sendButton.Text = "Send"
            '
            ' _stateViewer
            '
            _stateViewer.Anchor = AnchorStyles.Top Or AnchorStyles.Bottom Or AnchorStyles.Left
            _stateViewer.BackColor = SystemColors.InfoText
            _stateViewer.ForeColor = Color.White
            _stateViewer.Location = New Point(-3, 39)
            _stateViewer.Name = "_stateViewer"
            _stateViewer.Size = New Size(380, 444)
            _stateViewer.TabIndex = 1
            '
            ' CmdRestart
            '
            CmdRestart.Location = New Point(-3, 4)
            CmdRestart.Name = "CmdRestart"
            CmdRestart.Size = New Size(94, 29)
            CmdRestart.TabIndex = 2
            CmdRestart.Text = "Restart"
            CmdRestart.UseVisualStyleBackColor = True
            '
            ' MainForm
            '
            ClientSize = New Size(1051, 501)
            Controls.Add(CmdRestart)
            Controls.Add(_sendButton)
            Controls.Add(_inputBox)
            Controls.Add(_stateViewer)
            Controls.Add(_chatArea)
            Name = "MainForm"
            StartPosition = FormStartPosition.CenterScreen
            Text = "DDT Engine Test"
            ResumeLayout(False)
            PerformLayout()
        End Sub

        ''' <summary>
        ''' Carica il DDT di esempio (DatiPersonali) da JSON
        ''' </summary>
        Private Sub LoadTestDDT()
            Try
                ' Prova diversi percorsi per trovare il file JSON
                Dim possiblePaths As New List(Of String) From {
                    Path.Combine(Application.StartupPath, "..", "..", "..", "..", "TestData", "DatiPersonali.json"),
                    Path.Combine(Directory.GetCurrentDirectory(), "..", "..", "TestData", "DatiPersonali.json"),
                    Path.Combine(Path.GetDirectoryName(Application.ExecutablePath), "..", "..", "..", "..", "TestData", "DatiPersonali.json")
                }

                Dim jsonPath As String = Nothing
                For Each candidatePath As String In possiblePaths
                    Dim fullPath As String = Path.GetFullPath(candidatePath)
                    If File.Exists(fullPath) Then
                        jsonPath = fullPath
                        Exit For
                    End If
                Next

                If jsonPath Is Nothing Then
                    Throw New FileNotFoundException("File DatiPersonali.json non trovato. Cercato in: " & String.Join(", ", possiblePaths))
                End If

                ' Carica il DDT dal JSON
                _taskInstance = Global.TaskEngine.TaskLoader.LoadFromJson(jsonPath)
            Catch ex As Exception
                ' In caso di errore, mostra messaggio e usa DDT vuoto
                MessageBox.Show("Errore nel caricamento del DDT: " & ex.Message & vbCrLf & vbCrLf & "Stack: " & ex.StackTrace, "Errore", MessageBoxButtons.OK, MessageBoxIcon.Error)
                _taskInstance = New Global.TaskEngine.TaskInstance() With {
                    .IsAggregate = True,
                    .TaskList = New List(Of Global.TaskEngine.TaskNode)()
                }
            End Try
        End Sub

        ''' <summary>
        ''' Gestisce l'invio del messaggio
        ''' </summary>
        Private Sub SendButton_Click(sender As Object, e As EventArgs)
            SendMessage()
        End Sub

        ''' <summary>
        ''' Gestisce il tasto Invio nella input box
        ''' </summary>
        Private Sub InputBox_KeyDown(sender As Object, e As KeyEventArgs)
            If e.KeyCode = Keys.Enter Then
                SendMessage()
                e.Handled = True
            End If
        End Sub

        ''' <summary>
        ''' Invia il messaggio e processa
        ''' </summary>
        Private Sub SendMessage()
            Dim userInput As String = _inputBox.Text.Trim()
            If String.IsNullOrEmpty(userInput) Then
                Return
            End If

            ' Mostra messaggio utente
            AddChatMessage("User", userInput)
            _inputBox.Clear()

            ' Passa l'input al Parser (sveglia WaitForUserInput)
            Global.TaskEngine.Parser.SetUserInput(userInput)

            ' TODO: Aggiornare state viewer
            UpdateStateViewer()
        End Sub

        ''' <summary>
        ''' Aggiunge un messaggio alla chat
        ''' </summary>
        Private Sub AddChatMessage(sender As String, message As String)
            Dim timestamp As String = DateTime.Now.ToString("HH:mm:ss")
            _chatArea.AppendText($"[{timestamp}] {sender}: {message}" & vbCrLf)
            _chatArea.SelectionStart = _chatArea.Text.Length
            _chatArea.ScrollToCaret()
        End Sub

        ''' <summary>
        ''' Aggiorna il visualizzatore degli stati
        ''' </summary>
        Private Sub UpdateStateViewer()
            ' TODO: Mostrare gli stati dei dati
            _stateViewer.Items.Clear()
            _stateViewer.Items.Add("Stati Dati:")
            ' TODO: Iterare su mainData e subData e mostrare i loro stati
        End Sub

        ''' <summary>
        ''' Ottiene il valore di un nodo tramite path (es. "nominativo" o "nominativo.nome")
        ''' </summary>
        'Private Function GetNodeValueByPath(path As String, currentDataNode As Global.TaskEngine.TaskNode) As String
        '    If String.IsNullOrEmpty(path) OrElse _taskInstance Is Nothing Then
        '        Return ""
        '    End If

        '    ' Parsa il path (es. "nominativo.nome" -> ["nominativo", "nome"])
        '    Dim pathParts As String() = path.Split("."c)
        '    Dim mainDataId As String = pathParts(0)
        '    Dim subDataId As String = If(pathParts.Length > 1, pathParts(1), Nothing)

        '    ' Cerca il mainData
        '    Dim mainDataNode As Global.TaskEngine.TaskNode = _taskInstance.TaskList.FirstOrDefault(Function(m) m.Id = mainDataId)
        '    If mainDataNode Is Nothing Then
        '        Return ""
        '    End If

        '    ' Se c'è un subDataId, cerca il subData
        '    If Not String.IsNullOrEmpty(subDataId) Then
        '        Dim subDataNode As Global.TaskEngine.TaskNode = mainDataNode.SubData.FirstOrDefault(Function(s) s.Id = subDataId)
        '        If subDataNode IsNot Nothing AndAlso subDataNode.Value IsNot Nothing Then
        '            Return subDataNode.Value.ToString()
        '        End If
        '        Return ""
        '    End If

        '    ' Se non c'è subDataId, costruisci il valore completo del mainData composito
        '    If mainDataNode.HasSubData() Then
        '        ' Costruisci il valore dai subData
        '        Dim valueParts As New List(Of String)()
        '        For Each subData As Global.TaskEngine.TaskNode In mainDataNode.SubData
        '            If subData.Value IsNot Nothing Then
        '                valueParts.Add(subData.Value.ToString())
        '            End If
        '        Next
        '        Return String.Join(" ", valueParts)
        '    ElseIf mainDataNode.Value IsNot Nothing Then
        '        ' Se non ha subData, usa direttamente il valore
        '        Return mainDataNode.Value.ToString()
        '    End If

        '    Return ""
        'End Function

        ''' <summary>
        ''' Ottiene il valore di un nodo tramite path (es. "nominativo" o "nominativo.nome")
        ''' </summary>
        Private Function GetNodeValueByPath(path As String, currentDataNode As Global.TaskEngine.TaskNode) As String
            If String.IsNullOrEmpty(path) OrElse _taskInstance Is Nothing Then
                Return ""
            End If

            ' Parsa il path (es. "nominativo.nome" -> ["nominativo", "nome"])
            Dim pathParts As String() = path.Split("."c)
            Dim mainDataId As String = pathParts(0)
            Dim subDataId As String = If(pathParts.Length > 1, pathParts(1), Nothing)

            ' Cerca il mainData
            Dim matchingNodes = _taskInstance.TaskList.Where(Function(m) m.Id = mainDataId).ToList()
            If matchingNodes.Count = 0 Then
                Throw New InvalidOperationException($"MainDataNode with Id '{mainDataId}' not found in TaskInstance. Every main data reference must be valid.")
            ElseIf matchingNodes.Count > 1 Then
                Throw New InvalidOperationException($"MainDataNode with Id '{mainDataId}' appears {matchingNodes.Count} times. Each node ID must be unique.")
            End If
            Dim mainDataNode = matchingNodes.Single()
            ' ❌ RIMOSSO: Single() non può restituire Nothing, validazione già fatta sopra

            ' Se c'è un subDataId, cerca il subData
            If Not String.IsNullOrEmpty(subDataId) Then
                Dim matchingSubTasks = mainDataNode.SubTasks.Where(Function(s) s.Id = subDataId).ToList()
                If matchingSubTasks.Count = 0 Then
                    Throw New InvalidOperationException($"SubDataNode with Id '{subDataId}' not found in MainDataNode '{mainDataId}'. Every sub data reference must be valid.")
                ElseIf matchingSubTasks.Count > 1 Then
                    Throw New InvalidOperationException($"SubDataNode with Id '{subDataId}' appears {matchingSubTasks.Count} times in MainDataNode '{mainDataId}'. Each sub data ID must be unique.")
                End If
                Dim subDataNode = matchingSubTasks.Single()
                If subDataNode.Value IsNot Nothing Then
                    Return subDataNode.Value.ToString()
                End If
                Return ""
            End If

            ' Se non c'è subDataId, costruisci il valore completo del mainData composito
            If mainDataNode.HasSubTasks() Then
                ' Costruisci il valore dai subTasks
                Dim valueParts As New List(Of String)()
                For Each subData As Global.TaskEngine.TaskNode In mainDataNode.SubTasks
                    If subData.Value IsNot Nothing Then
                        valueParts.Add(subData.Value.ToString())
                    End If
                Next
                Return String.Join(" ", valueParts)
            ElseIf mainDataNode.Value IsNot Nothing Then
                ' Se non ha subData, usa direttamente il valore
                Return mainDataNode.Value.ToString()
            End If

            Return ""
        End Function

        ''' <summary>
        ''' Gestisce il click sul button Restart
        ''' Resetta tutto e ricarica il DDT
        ''' </summary>
        Private Sub CmdRestart_Click(sender As Object, e As EventArgs) Handles CmdRestart.Click
            ' Ferma il thread del motore se è in esecuzione
            If _isEngineRunning AndAlso _engineThread IsNot Nothing Then
                _isEngineRunning = False
                If _engineThread.IsAlive Then
                    _engineThread.Join(1000) ' Aspetta max 1 secondo
                End If
            End If

            ' Resetta il motore (pulisce contatori, ecc.)
            _engine.Reset()

            ' Pulisce la coda di input
            Global.TaskEngine.Parser.ClearInputQueue()

            ' Pulisce la chat
            _chatArea.Clear()

            ' Pulisce lo state viewer
            _stateViewer.Items.Clear()

            ' Pulisce l'input box
            _inputBox.Clear()

            ' Ricarica il DDT
            LoadTestDDT()

            ' Resetta tutti i nodi del DDT (stati, valori, ecc.)
            If _taskInstance IsNot Nothing Then
                _taskInstance.Reset()
            End If

            ' Avvia il motore in un thread separato per non bloccare l'UI
            _isEngineRunning = True
            _engineThread = New Thread(
                Sub()
                    Try
                        _engine.ExecuteTask(_taskInstance)
                    Catch ex As Exception
                        ' Gestisci errori nel thread
                        Me.Invoke(Sub() AddChatMessage("System", "Errore nel motore: " & ex.Message))
                    Finally
                        _isEngineRunning = False
                    End Try
                End Sub
            )
            _engineThread.IsBackground = True
            _engineThread.Start()

            ' Rimette il focus sull'input box
            _inputBox.Focus()
        End Sub

        ''' <summary>
        ''' Gestisce l'evento MessageToShow dal ResponseManager
        ''' Mostra il messaggio nella chat
        ''' </summary>
        Private Sub OnMessageToShow(sender As Object, e As Global.TaskEngine.MessageEventArgs)
            If e IsNot Nothing AndAlso Not String.IsNullOrEmpty(e.Message) Then
                ' Usa Invoke per eseguire sul thread UI se necessario
                If Me.InvokeRequired Then
                    Me.Invoke(Sub() AddChatMessage("Bot", e.Message))
                Else
                    AddChatMessage("Bot", e.Message)
                End If
            End If
        End Sub


        Private Sub _inputBox_KeyDown(sender As Object, e As KeyEventArgs) Handles _inputBox.KeyDown
            If e.KeyCode = Keys.Enter Then
                SendMessage()
                e.Handled = True
            End If
        End Sub
    End Class

End Namespace

