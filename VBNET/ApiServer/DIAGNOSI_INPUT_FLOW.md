# Diagnosi: Flusso Input Utente

## Flusso Atteso (Teorico)

```
1. Frontend invia POST /api/runtime/task/session/{id}/input
   ↓
2. HandleTaskSessionInput riceve la richiesta
   ↓
3. Parser.SetUserInput(input) - invia input alla coda thread-safe
   ↓
4. Parser.InterpretUtterance(currTaskNode) - estrae dati dall'input
   ↓
5. Motore.SetState(parseResult, currentState, currTaskNode) - aggiorna stato
   ↓
6. Motore.ExecuteTask(taskInstance) - continua esecuzione
   ↓
7. Motore.GetNextTask(taskInstance) - trova prossimo task
   ↓
8. Motore.GetResponse(currTaskNode) - trova step da eseguire
   ↓
9. Motore.ExecuteResponse(tasks, currTaskNode, taskInstance) - esegue tasks
   ↓
10. MessageTask.Execute() - solleva evento MessageToShow
   ↓
11. SessionManager.MessageToShow handler - emette via SSE
   ↓
12. Frontend riceve messaggio via SSE
```

## Problema Attuale

`HandleTaskSessionInput` ha solo un TODO e non chiama nessuno dei metodi sopra.

## Strategia di Debug

### STEP 1: Verificare che HandleTaskSessionInput venga chiamato

**Breakpoint:**
- File: `VBNET/ApiServer/Handlers/TaskSessionHandlers.vb`
- Riga: 671 (inizio funzione `HandleTaskSessionInput`)

**Log da aggiungere:**
```vb
Console.WriteLine($"[DIAG] HandleTaskSessionInput ENTRY: sessionId={sessionId}")
```

**Cosa verificare:**
- ✅ La funzione viene chiamata quando l'utente invia input
- ✅ Il `sessionId` è corretto
- ✅ La richiesta HTTP arriva correttamente

---

### STEP 2: Verificare parsing della richiesta

**Breakpoint:**
- File: `VBNET/ApiServer/Handlers/TaskSessionHandlers.vb`
- Riga: 675 (dopo `DeserializeObject`)

**Log da aggiungere:**
```vb
Console.WriteLine($"[DIAG] Request parsed: Input='{If(request IsNot Nothing, request.Input, "Nothing")}'")
```

**Cosa verificare:**
- ✅ `request` non è `Nothing`
- ✅ `request.Input` contiene l'input dell'utente (es. "1")
- ✅ L'input non è vuoto

---

### STEP 3: Verificare che la sessione esista

**Breakpoint:**
- File: `VBNET/ApiServer/Handlers/TaskSessionHandlers.vb`
- Riga: 682 (dopo `GetTaskSession`)

**Log da aggiungere:**
```vb
Console.WriteLine($"[DIAG] Session found: IsNothing={session Is Nothing}, TaskEngine IsNothing={If(session IsNot Nothing, session.TaskEngine Is Nothing, True)}")
```

**Cosa verificare:**
- ✅ `session` non è `Nothing`
- ✅ `session.TaskEngine` non è `Nothing`
- ✅ La sessione è quella corretta

---

### STEP 4: Verificare che Parser.SetUserInput NON viene chiamato (attualmente)

**Breakpoint:**
- File: `VBNET/DDTEngine/Engine/Parser.vb`
- Riga: 231 (inizio funzione `SetUserInput`)

**Log da aggiungere:**
```vb
Console.WriteLine($"[DIAG] Parser.SetUserInput CALLED: input='{input}'")
```

**Cosa verificare:**
- ❌ Questo breakpoint NON viene mai raggiunto (conferma che il problema è qui)
- Se viene raggiunto, verificare che `input` contenga il valore corretto

---

### STEP 5: Verificare che Parser.InterpretUtterance NON viene chiamato (attualmente)

**Breakpoint:**
- File: `VBNET/DDTEngine/Engine/Parser.vb`
- Riga: 27 (inizio funzione `InterpretUtterance`)

**Log da aggiungere:**
```vb
Console.WriteLine($"[DIAG] Parser.InterpretUtterance CALLED: nodeId={currTaskNode.Id}, State={currTaskNode.State}")
```

**Cosa verificare:**
- ❌ Questo breakpoint NON viene mai raggiunto (conferma che il problema è qui)
- Se viene raggiunto, verificare che `currTaskNode` sia quello corretto

---

### STEP 6: Verificare che Motore.SetState NON viene chiamato (attualmente)

**Breakpoint:**
- File: `VBNET/DDTEngine/Engine/Motore.vb`
- Riga: 269 (inizio funzione `SetState`)

**Log esistenti:**
- Già presente: `[MOTORE] SetState CALLED: ...`

**Cosa verificare:**
- ❌ Questo breakpoint NON viene mai raggiunto dopo l'input (conferma che il problema è qui)
- Se viene raggiunto, verificare `parseResult.Result` e `currTaskNode.State`

---

### STEP 7: Verificare che Motore.ExecuteTask NON viene richiamato dopo l'input

**Breakpoint:**
- File: `VBNET/DDTEngine/Engine/Motore.vb`
- Riga: 29 (inizio funzione `ExecuteTask`)

**Log esistenti:**
- Già presente: `[MOTORE] ExecuteTask START: ...`

**Cosa verificare:**
- ❌ Questo breakpoint viene raggiunto SOLO all'avvio sessione, NON dopo l'input
- Se viene raggiunto dopo l'input, verificare da dove viene chiamato

---

### STEP 8: Verificare che MessageToShow NON viene sollevato dopo l'input

**Breakpoint:**
- File: `VBNET/ApiServer/SessionManager.vb`
- Riga: 247 (inizio handler `MessageToShow`)

**Log da aggiungere:**
```vb
Console.WriteLine($"[DIAG] MessageToShow event raised: message='{e.Message}'")
```

**Cosa verificare:**
- ❌ Questo breakpoint NON viene mai raggiunto dopo l'input (conferma che il problema è qui)
- Se viene raggiunto, verificare che `e.Message` contenga il messaggio corretto

---

## Diagnosi Attesa

### Scenario A: Il flusso si ferma in HandleTaskSessionInput

**Se vedi:**
- ✅ `[DIAG] HandleTaskSessionInput ENTRY` appare
- ✅ `[DIAG] Request parsed` appare
- ✅ `[DIAG] Session found` appare
- ❌ Nessun altro log dopo

**Diagnosi:**
Il flusso si interrompe in `HandleTaskSessionInput` alla riga 688. Il metodo ha solo un TODO e non chiama nessun altro metodo. **Il problema è che `HandleTaskSessionInput` non processa l'input.**

**Causa probabile:**
- `HandleTaskSessionInput` non chiama `Parser.SetUserInput()`
- `HandleTaskSessionInput` non chiama `Parser.InterpretUtterance()`
- `HandleTaskSessionInput` non chiama `Motore.SetState()`
- `HandleTaskSessionInput` non richiama `Motore.ExecuteTask()`

---

### Scenario B: Il flusso arriva fino a Parser.SetUserInput ma non oltre

**Se vedi:**
- ✅ `[DIAG] Parser.SetUserInput CALLED` appare
- ❌ `[DIAG] Parser.InterpretUtterance CALLED` NON appare

**Diagnosi:**
L'input viene inviato al Parser, ma `InterpretUtterance` non viene chiamato. **Il problema è che manca la chiamata a `InterpretUtterance` dopo `SetUserInput`.**

**Causa probabile:**
- `HandleTaskSessionInput` chiama `SetUserInput` ma non chiama `InterpretUtterance`
- Oppure `InterpretUtterance` viene chiamato ma in un contesto sbagliato (es. senza `currTaskNode`)

---

### Scenario C: Il flusso arriva fino a InterpretUtterance ma non oltre

**Se vedi:**
- ✅ `[DIAG] Parser.InterpretUtterance CALLED` appare
- ❌ `[MOTORE] SetState CALLED` NON appare dopo l'input

**Diagnosi:**
L'input viene interpretato, ma `SetState` non viene chiamato. **Il problema è che manca la chiamata a `SetState` dopo `InterpretUtterance`.**

**Causa probabile:**
- `HandleTaskSessionInput` chiama `InterpretUtterance` ma non chiama `SetState`
- Oppure `SetState` viene chiamato ma con parametri errati

---

### Scenario D: Il flusso arriva fino a SetState ma non oltre

**Se vedi:**
- ✅ `[MOTORE] SetState CALLED` appare
- ✅ `[MOTORE] SetState COMPLETE` appare
- ❌ `[MOTORE] ExecuteTask START` NON appare dopo l'input

**Diagnosi:**
Lo stato viene aggiornato, ma `ExecuteTask` non viene richiamato. **Il problema è che manca la chiamata a `ExecuteTask` dopo `SetState`.**

**Causa probabile:**
- `HandleTaskSessionInput` chiama `SetState` ma non richiama `ExecuteTask`
- Oppure `ExecuteTask` viene chiamato ma in un contesto sbagliato (es. senza `TaskInstance`)

---

### Scenario E: Il flusso arriva fino a ExecuteTask ma non genera messaggi

**Se vedi:**
- ✅ `[MOTORE] ExecuteTask START` appare dopo l'input
- ✅ `[MOTORE] GetNextTask` appare
- ❌ `[DIAG] MessageToShow event raised` NON appare

**Diagnosi:**
`ExecuteTask` viene richiamato, ma non genera messaggi. **Il problema è che `GetNextTask` non trova il task corretto, oppure `GetResponse` non trova lo step corretto, oppure `ExecuteResponse` non esegue i tasks.**

**Causa probabile:**
- `GetNextTask` ritorna `Nothing` (tutti i task sono completati o in stato sbagliato)
- `GetResponse` non trova lo step per lo stato corrente
- `ExecuteResponse` non esegue i tasks (lista vuota)
- `MessageTask.Execute()` non viene chiamato

---

## Log Aggiunti (✅ Implementati)

### In HandleTaskSessionInput
- ✅ `[DIAG] HandleTaskSessionInput ENTRY: sessionId={sessionId}`
- ✅ `[DIAG] Request parsed: Input='{input}'`
- ✅ `[DIAG] Session found: IsNothing={...}, TaskEngine IsNothing={...}`
- ✅ `[DIAG] HandleTaskSessionInput: Input received='{input}', SessionId={sessionId}`
- ✅ `[DIAG] HandleTaskSessionInput: IsWaitingForInput={...}`
- ✅ `[DIAG] HandleTaskSessionInput: About to clear waiting state and return (TODO: process input)`

### In Parser.SetUserInput
- ✅ `[DIAG] Parser.SetUserInput CALLED: input='{input}', QueueCount before={...}`
- ✅ `[DIAG] Parser.SetUserInput: Input added to queue, QueueCount after={...}` (se aggiunto)
- ✅ `[DIAG] Parser.SetUserInput: Input is empty, NOT added to queue` (se vuoto)

### In Parser.WaitForUserInput
- ✅ `[DIAG] Parser.WaitForUserInput CALLED: QueueCount={...}, Timeout={...}s`
- ✅ `[DIAG] Parser.WaitForUserInput: Input received from queue: '{input}'` (se ricevuto)
- ✅ `[DIAG] Parser.WaitForUserInput: TIMEOUT - no input received after {timeout}s` (se timeout)
- ✅ `[DIAG] Parser.WaitForUserInput: OperationCanceledException - {message}` (se eccezione)

### In Parser.InterpretUtterance
- ✅ `[DIAG] Parser.InterpretUtterance CALLED: nodeId={...}, State={...}, IsSubData={...}`
- ✅ `[DIAG] Parser.InterpretUtterance: userInput received='{input}'`
- ✅ `[DIAG] Parser.InterpretUtterance: Returning NoInput (empty or timeout)` (se NoInput)
- ✅ `[DIAG] Parser.InterpretUtterance: Returning NoMatch (no data extracted)` (se NoMatch)
- ✅ `[DIAG] Parser.InterpretUtterance: Returning Match, extractedValue='{...}', nodeValue set to '{...}'` (se Match)

### In SessionManager.MessageToShow handler
- ✅ `[DIAG] MessageToShow event raised: message='{message}', sessionId={sessionId}`

### Log Esistenti (Già Presenti)
- ✅ `[MOTORE] ExecuteTask START: TaskList.Count={...}`
- ✅ `[MOTORE] GetNextTask: checking {count} main nodes`
- ✅ `[MOTORE] SetState CALLED: parseResult={...}, currentState={...}, nodeId={...}`
- ✅ `[MOTORE] SetState COMPLETE: nodeId={...}, newState={...}`

---

## Log da Aggiungere (Solo per Diagnosi - OBSOLETO, GIÀ IMPLEMENTATO)

### In HandleTaskSessionInput

```vb
' Dopo riga 688
Console.WriteLine($"[DIAG] HandleTaskSessionInput: Input received='{request.Input}', SessionId={sessionId}")
Console.WriteLine($"[DIAG] HandleTaskSessionInput: Session IsNothing={session Is Nothing}")
If session IsNot Nothing Then
    Console.WriteLine($"[DIAG] HandleTaskSessionInput: TaskEngine IsNothing={session.TaskEngine Is Nothing}")
    Console.WriteLine($"[DIAG] HandleTaskSessionInput: IsWaitingForInput={session.IsWaitingForInput}")
End If
Console.WriteLine($"[DIAG] HandleTaskSessionInput: About to clear waiting state and return")
```

### In Parser.SetUserInput

```vb
' Dopo riga 231
Console.WriteLine($"[DIAG] Parser.SetUserInput CALLED: input='{input}', QueueCount before={_inputQueue.Count}")
```

### In Parser.InterpretUtterance

```vb
' Dopo riga 27
Console.WriteLine($"[DIAG] Parser.InterpretUtterance CALLED: nodeId={currTaskNode.Id}, State={currTaskNode.State}, IsSubData={currTaskNode.IsSubData}")
```

### In SessionManager.MessageToShow handler

```vb
' Dopo riga 247
Console.WriteLine($"[DIAG] MessageToShow event raised: message='{e.Message}', sessionId={sessionId}")
```

---

## Ordine di Esecuzione Test

1. Avvia il backend VB.NET
2. Avvia il frontend
3. Apri il Chat Simulator
4. Verifica che la sessione venga creata (log `[SESSION] Starting runtime execution`)
5. Verifica che il primo messaggio arrivi (log `[MOTORE] Message emitted`)
6. Verifica che `waitingForInput` arrivi via SSE
7. **Invia input "1"**
8. Controlla i log nell'ordine:
   - `[DIAG] HandleTaskSessionInput ENTRY` → deve apparire
   - `[DIAG] Request parsed` → deve apparire
   - `[DIAG] Session found` → deve apparire
   - `[DIAG] Parser.SetUserInput CALLED` → NON deve apparire (problema qui)
   - `[DIAG] Parser.InterpretUtterance CALLED` → NON deve apparire
   - `[MOTORE] SetState CALLED` → NON deve apparire
   - `[MOTORE] ExecuteTask START` → NON deve apparire dopo l'input
   - `[DIAG] MessageToShow event raised` → NON deve apparire dopo l'input

---

## ✅ DIAGNOSI CONFERMATA (Test Eseguito)

**Data test:** 2026-02-02
**Input inviato:** "1"
**SessionId:** 000bf241-636b-40a5-8725-5f8696214bda

### Log Osservati:

✅ **STEP 1-3: HandleTaskSessionInput riceve correttamente la richiesta**
```
[DIAG] HandleTaskSessionInput ENTRY: sessionId=000bf241-636b-40a5-8725-5f8696214bda
[DIAG] Request parsed: Input='1'
[DIAG] Session found: IsNothing=False, TaskEngine IsNothing=False
[DIAG] HandleTaskSessionInput: Input received='1', SessionId=000bf241-636b-40a5-8725-5f8696214bda
[DIAG] HandleTaskSessionInput: IsWaitingForInput=True
[DIAG] HandleTaskSessionInput: About to clear waiting state and return (TODO: process input)
```

❌ **STEP 4-11: Nessun altro metodo viene chiamato**
- `[DIAG] Parser.SetUserInput CALLED` → **NON APPARE**
- `[DIAG] Parser.InterpretUtterance CALLED` → **NON APPARE**
- `[MOTORE] SetState CALLED` → **NON APPARE**
- `[MOTORE] ExecuteTask START` (dopo input) → **NON APPARE**
- `[DIAG] MessageToShow event raised` (dopo input) → **NON APPARE**

### ✅ DIAGNOSI FINALE:

**Il flusso si interrompe esattamente in `HandleTaskSessionInput` alla riga 688.**

Il metodo:
- ✅ Riceve correttamente l'input "1"
- ✅ Trova correttamente la sessione
- ✅ Verifica correttamente `IsWaitingForInput=True`
- ❌ **NON chiama `Parser.SetUserInput()`**
- ❌ **NON chiama `Parser.InterpretUtterance()`**
- ❌ **NON chiama `Motore.SetState()`**
- ❌ **NON richiama `Motore.ExecuteTask()`**
- ❌ **Si limita a cancellare `IsWaitingForInput` e ritorna `200 OK`**

**Il problema è strutturale: `HandleTaskSessionInput` ha solo un TODO e non implementa la logica per processare l'input.**

---

## Conclusione Attesa (OBSOLETO - Vedi Diagnosi Confermata sopra)

**Diagnosi più probabile:**
Il flusso si interrompe in `HandleTaskSessionInput` alla riga 688. Il metodo ha solo un TODO e non chiama nessun altro metodo. **Il problema è strutturale: `HandleTaskSessionInput` non implementa la logica per processare l'input.**

**Prossimi passi (dopo diagnosi confermata):**

### Problemi Strutturali Identificati:

1. **`TaskSession` non salva `TaskInstance`**
   - Attualmente: `TaskInstance` viene creato in `CreateTaskSession` ma non viene salvato
   - Necessario: Aggiungere `Public Property TaskInstance As TaskEngine.TaskInstance` a `TaskSession`
   - Necessario: Salvare `TaskInstance` in `CreateTaskSession` dopo la conversione

2. **`Motore._parser` è `Private`**
   - Attualmente: `Private ReadOnly _parser As Parser`
   - Necessario: Rendere pubblico o esporre un metodo pubblico per accedere al `Parser`
   - Alternativa: Usare `Parser.SetUserInput()` che è `Shared` (già disponibile)

3. **Come ottenere il `TaskNode` corrente**
   - Necessario: Chiamare `Motore.GetNextTask(taskInstance)` per ottenere il task corrente
   - Verificare: Il task corrente deve essere quello in stato `Start`, `NoMatch`, `NoInput`, `Confirmation`, `NotConfirmed`

4. **Implementare la logica in `HandleTaskSessionInput`**
   - Ottenere `TaskInstance` dalla sessione (dopo averlo salvato)
   - Ottenere `TaskNode` corrente con `session.TaskEngine.GetNextTask(session.TaskInstance)`
   - Chiamare `Parser.SetUserInput(request.Input)` (già `Shared`, non serve accesso a `Motore._parser`)
   - Chiamare `session.TaskEngine.Parser.InterpretUtterance(currTaskNode)` (dopo aver reso `Parser` pubblico)
   - Chiamare `session.TaskEngine.SetState(parseResult, currTaskNode.State, currTaskNode)`
   - Richiamare `session.TaskEngine.ExecuteTask(session.TaskInstance)`

### Note Importanti:

- `Parser.SetUserInput()` è già `Shared`, quindi può essere chiamato senza accesso a `Motore._parser`
- `Parser.InterpretUtterance()` è un metodo di istanza, quindi serve accesso all'istanza `Parser` di `Motore`
- `Motore.ExecuteTask()` è già pubblico e può essere richiamato
- `Motore.SetState()` è già pubblico e può essere chiamato
