' MainForm.vb
' Test UI for the DDT Engine using the new stateless TaskUtterance API.

Option Strict On
Option Explicit On

Imports System.Drawing
Imports System.IO
Imports System.Windows.Forms
Imports TaskEngine

Namespace TaskEngine.TestUI

    ''' <summary>
    ''' Chat-style test form for the DDT Engine.
    ''' Uses the stateless Motore.ExecuteTurn / ProcessInput API directly —
    ''' no background threads required.
    ''' </summary>
    Public Class MainForm
        Inherits Form

        Private ReadOnly _engine As Motore
        Private _chatArea As TextBox
        Private WithEvents _inputBox As TextBox
        Private _sendButton As Button
        Private _stateViewer As ListBox
        Friend WithEvents CmdRestart As Button
        Private _taskInstance As Global.TaskEngine.TaskUtterance

        Public Sub New()
            _engine = New Global.TaskEngine.Motore()
            InitializeComponent()
            AddHandler _engine.MessageToShow, AddressOf OnMessageToShow
        End Sub

        Private Sub InitializeComponent()
            _chatArea = New TextBox()
            _inputBox = New TextBox()
            _sendButton = New Button()
            _stateViewer = New ListBox()
            CmdRestart = New Button()
            SuspendLayout()

            _chatArea.Anchor = AnchorStyles.Top Or AnchorStyles.Bottom Or AnchorStyles.Left Or AnchorStyles.Right
            _chatArea.BackColor = Color.Black
            _chatArea.ForeColor = Color.White
            _chatArea.Location = New Point(383, 39)
            _chatArea.Multiline = True
            _chatArea.Name = "_chatArea"
            _chatArea.Size = New Size(669, 428)
            _chatArea.TabIndex = 0

            _inputBox.Anchor = AnchorStyles.Bottom Or AnchorStyles.Left Or AnchorStyles.Right
            _inputBox.BackColor = Color.Black
            _inputBox.ForeColor = Color.White
            _inputBox.Location = New Point(383, 473)
            _inputBox.Name = "_inputBox"
            _inputBox.Size = New Size(588, 27)
            _inputBox.TabIndex = 0

            _sendButton.Anchor = AnchorStyles.Bottom Or AnchorStyles.Right
            _sendButton.Location = New Point(977, 473)
            _sendButton.Name = "_sendButton"
            _sendButton.Size = New Size(75, 29)
            _sendButton.TabIndex = 1
            _sendButton.Text = "Send"
            AddHandler _sendButton.Click, AddressOf SendButton_Click

            _stateViewer.Anchor = AnchorStyles.Top Or AnchorStyles.Bottom Or AnchorStyles.Left
            _stateViewer.BackColor = SystemColors.InfoText
            _stateViewer.ForeColor = Color.White
            _stateViewer.Location = New Point(-3, 39)
            _stateViewer.Name = "_stateViewer"
            _stateViewer.Size = New Size(380, 444)
            _stateViewer.TabIndex = 1

            CmdRestart.Location = New Point(-3, 4)
            CmdRestart.Name = "CmdRestart"
            CmdRestart.Size = New Size(94, 29)
            CmdRestart.TabIndex = 2
            CmdRestart.Text = "Restart"
            CmdRestart.UseVisualStyleBackColor = True

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

        ' -------------------------------------------------------------------------
        ' DDT loading
        ' -------------------------------------------------------------------------

        Private Sub LoadTestDDT()
            Try
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
                    Throw New FileNotFoundException(
                        "File DatiPersonali.json non trovato. Cercato in: " &
                        String.Join(", ", possiblePaths))
                End If

                _taskInstance = Global.TaskEngine.TaskLoader.LoadFromJson(jsonPath)
            Catch ex As Exception
                MessageBox.Show("Errore nel caricamento del DDT: " & ex.Message &
                                vbCrLf & vbCrLf & "Stack: " & ex.StackTrace,
                                "Errore", MessageBoxButtons.OK, MessageBoxIcon.Error)

                ' Fallback: empty task utterance
                _taskInstance = New Global.TaskEngine.TaskUtterance() With {
                    .IsAggregate = True,
                    .SubTasks = New List(Of Global.TaskEngine.TaskUtterance)()
                }
            End Try
        End Sub

        ' -------------------------------------------------------------------------
        ' Engine turn management (stateless — no background thread needed)
        ' -------------------------------------------------------------------------

        Private Sub RunEngineTurn()
            If _taskInstance Is Nothing Then Return

            ' Run the engine until it waits for input or completes.
            Dim turnResult = _engine.ExecuteTurn(_taskInstance)

            Select Case turnResult.Status
                Case TurnStatus.Completed
                    AddChatMessage("System", "Task completato.")
                    _inputBox.Enabled = False
                    _sendButton.Enabled = False

                Case TurnStatus.SessionClosed
                    AddChatMessage("System", "Sessione chiusa.")
                    _inputBox.Enabled = False
                    _sendButton.Enabled = False

                Case TurnStatus.Continue
                    ' Engine can continue without input — run another turn.
                    RunEngineTurn()

                Case Else ' WaitingForInput
                    _inputBox.Enabled = True
                    _sendButton.Enabled = True
            End Select

            UpdateStateViewer()
        End Sub

        ' -------------------------------------------------------------------------
        ' UI event handlers
        ' -------------------------------------------------------------------------

        Private Sub SendButton_Click(sender As Object, e As EventArgs)
            SendMessage()
        End Sub

        Private Sub _inputBox_KeyDown(sender As Object, e As KeyEventArgs) Handles _inputBox.KeyDown
            If e.KeyCode = Keys.Enter Then
                SendMessage()
                e.Handled = True
            End If
        End Sub

        Private Sub SendMessage()
            Dim userInput As String = _inputBox.Text.Trim()
            If String.IsNullOrEmpty(userInput) Then Return

            AddChatMessage("User", userInput)
            _inputBox.Clear()
            _inputBox.Enabled = False
            _sendButton.Enabled = False

            ' Feed input to the engine (updates state machine).
            _engine.ProcessInput(_taskInstance, userInput)

            ' Run the next engine turn.
            RunEngineTurn()
        End Sub

        Private Sub CmdRestart_Click(sender As Object, e As EventArgs) Handles CmdRestart.Click
            _chatArea.Clear()
            _stateViewer.Items.Clear()
            _inputBox.Clear()
            _inputBox.Enabled = True
            _sendButton.Enabled = True

            LoadTestDDT()

            If _taskInstance IsNot Nothing Then _taskInstance.Reset()

            RunEngineTurn()
            _inputBox.Focus()
        End Sub

        Private Sub OnMessageToShow(sender As Object, e As Global.TaskEngine.MessageEventArgs)
            If e IsNot Nothing AndAlso Not String.IsNullOrEmpty(e.Message) Then
                If Me.InvokeRequired Then
                    Me.Invoke(Sub() AddChatMessage("Bot", e.Message))
                Else
                    AddChatMessage("Bot", e.Message)
                End If
            End If
        End Sub

        ' -------------------------------------------------------------------------
        ' UI helpers
        ' -------------------------------------------------------------------------

        Private Sub AddChatMessage(sender As String, message As String)
            Dim timestamp As String = DateTime.Now.ToString("HH:mm:ss")
            _chatArea.AppendText($"[{timestamp}] {sender}: {message}" & vbCrLf)
            _chatArea.SelectionStart = _chatArea.Text.Length
            _chatArea.ScrollToCaret()
        End Sub

        Private Sub UpdateStateViewer()
            _stateViewer.Items.Clear()
            _stateViewer.Items.Add("Stati TaskUtterance:")
            If _taskInstance IsNot Nothing Then
                AppendStateForTask(_taskInstance, "")
            End If
        End Sub

        Private Sub AppendStateForTask(task As Global.TaskEngine.TaskUtterance, indent As String)
            Dim value As String = If(task.Value IsNot Nothing, task.Value.ToString(), "(vuoto)")
            _stateViewer.Items.Add($"{indent}{task.Id}: {task.State} = {value}")
            If task.SubTasks IsNot Nothing Then
                For Each child In task.SubTasks
                    AppendStateForTask(child, indent & "  ")
                Next
            End If
        End Sub

        ''' <summary>
        ''' Returns the collected value for a task identified by dot-path (e.g. "nominativo.nome").
        ''' </summary>
        Private Function GetNodeValueByPath(path As String,
                                             rootTask As Global.TaskEngine.TaskUtterance) As String
            If String.IsNullOrEmpty(path) OrElse rootTask Is Nothing Then Return ""

            Dim parts = path.Split("."c)
            Dim current As Global.TaskEngine.TaskUtterance = rootTask
            For Each part In parts
                If current.SubTasks Is Nothing Then Return ""
                Dim found = current.SubTasks.FirstOrDefault(Function(t) t.Id = part)
                If found Is Nothing Then Return ""
                current = found
            Next

            If current.SubTasks IsNot Nothing AndAlso current.SubTasks.Any() Then
                Return String.Join(" ", current.SubTasks.
                    Where(Function(s) s.Value IsNot Nothing).
                    Select(Function(s) s.Value.ToString()))
            End If

            Return If(current.Value IsNot Nothing, current.Value.ToString(), "")
        End Function
    End Class

End Namespace
