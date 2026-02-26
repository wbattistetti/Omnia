# Guida Studio: Routine VB.NET per ProcessTurn (Fase 1)

Questa guida elenca tutte le routine VB.NET che devi studiare per capire in dettaglio cosa fanno nella prima fase di implementazione di ProcessTurn.

## 📋 Routine da Studiare (in ordine di importanza)

### 1. **SessionManager.vb** - Gestione Sessioni e Repository

#### `GetTaskSession(sessionId As String) As TaskSession`
- **Cosa fa**: Carica una TaskSession da Redis usando il sessionId
- **Dove**: `VBNET/ApiServer/SessionManager.vb` (linea ~523)
- **Perché studiarla**: ProcessTurn deve caricare lo stato dalla sessione
- **Cosa restituisce**: TaskSession con DialogueContextJson, ProjectId, DialogVersion, Locale

#### `SaveTaskSession(session As TaskSession)`
- **Cosa fa**: Salva una TaskSession su Redis
- **Dove**: `VBNET/ApiServer/SessionManager.vb` (linea ~532)
- **Perché studiarla**: ProcessTurn deve salvare il nuovo stato dopo ogni turno
- **Cosa fa**: Serializza TaskSession e salva su Redis con TTL

#### `GetDialogRepository() As IDialogRepository`
- **Cosa fa**: Restituisce il repository per caricare dialoghi compilati
- **Dove**: `VBNET/ApiServer/SessionManager.vb` (appena aggiunto)
- **Perché studiarla**: ProcessTurn deve caricare CompiledUtteranceTask dal repository
- **Cosa restituisce**: IDialogRepository (RedisDialogRepository)

#### `GetTranslationRepository() As ITranslationRepository`
- **Cosa fa**: Restituisce il repository per caricare traduzioni
- **Dove**: `VBNET/ApiServer/SessionManager.vb` (appena aggiunto)
- **Perché studiarla**: ProcessTurn deve risolvere TextKey in testo tradotto
- **Cosa restituisce**: ITranslationRepository (RedisTranslationRepository)

#### `GetOrCreateDialogueContext(session As TaskSession) As DialogueContext`
- **Cosa fa**: Carica DialogueContext dalla sessione o lo crea se non esiste
- **Dove**: `VBNET/ApiServer/SessionManager.vb` (linea ~705)
- **Perché studiarla**: ProcessTurn deve accedere a DialogueState che è dentro DialogueContext
- **Cosa restituisce**: DialogueContext con DialogueState, Steps, CurrentStep

#### `SaveDialogueContext(session As TaskSession, ctx As DialogueContext)`
- **Cosa fa**: Salva DialogueContext nella sessione (serializza in DialogueContextJson)
- **Dove**: `VBNET/ApiServer/SessionManager.vb` (linea ~732)
- **Perché studiarla**: ProcessTurn deve salvare il nuovo DialogueState dopo ogni turno
- **Cosa fa**: Serializza DialogueContext in JSON e lo salva in session.DialogueContextJson

---

### 2. **DialogRepository.vb** - Caricamento Dialoghi

#### `GetDialog(projectId As String, version As String) As RuntimeTask`
- **Cosa fa**: Carica un dialogo compilato dal repository (Redis)
- **Dove**: `VBNET/ApiServer/Repositories/DialogRepository.vb` (linea ~55)
- **Perché studiarla**: ProcessTurn deve caricare CompiledUtteranceTask
- **Cosa restituisce**: RuntimeTask (può essere CompiledUtteranceTask)
- **Nota**: Usa cache in memoria per performance

---

### 3. **TranslationRepository.vb** - Caricamento Traduzioni

#### `GetTranslation(projectId As String, locale As String, textKey As String) As String`
- **Cosa fa**: Carica una traduzione dal repository (Redis)
- **Dove**: `VBNET/ApiServer/Repositories/TranslationRepository.vb` (linea ~52)
- **Perché studiarla**: ProcessTurn deve risolvere TextKey (GUID) in testo tradotto
- **Cosa restituisce**: Testo tradotto o Nothing se non trovato
- **Nota**: Usa cache in memoria per performance

#### `GetTranslationsBatch(projectId As String, locale As String, textKeys As List(Of String)) As Dictionary(Of String, String)`
- **Cosa fa**: Carica multiple traduzioni in batch (più efficiente)
- **Dove**: `VBNET/ApiServer/Repositories/TranslationRepository.vb` (linea ~100)
- **Perché studiarla**: ProcessTurn potrebbe dover caricare molte traduzioni
- **Cosa restituisce**: Dictionary(Of String, String) con textKey -> testo

---

### 4. **DialogueState.vb** - Stato del Dialogo

#### `DialogueState` (Classe)
- **Cosa fa**: Rappresenta lo stato completo del dialogo
- **Dove**: `VBNET/Orchestrator/TaskEngine/Types.vb` (linea ~112)
- **Perché studiarla**: ProcessTurn riceve e restituisce DialogueState
- **Proprietà importanti**:
  - `Memory As Dictionary(Of String, Object)` - Valori estratti (nodeId -> value)
  - `Counters As Dictionary(Of String, Counters)` - Contatori escalation per nodo
  - `TurnState As TurnState` - Stato corrente (Start, NoMatch, NoInput, Success)
  - `Context As String` - "CollectingMain" | "CollectingSub"
  - `CurrentDataId As String` - ID del nodo corrente in raccolta

---

### 5. **DialogueContext.vb** - Contesto del Dialogo

#### `DialogueContext` (Classe)
- **Cosa fa**: Contiene DialogueState + Steps + CurrentStep
- **Dove**: `VBNET/Orchestrator/TaskEngine/DialogueContext.vb` (linea ~9)
- **Perché studiarla**: DialogueState è salvato dentro DialogueContext nella sessione
- **Proprietà importanti**:
  - `DialogueState As DialogueState` - Stato del dialogo
  - `Steps As List(Of TaskStep)` - Steps del task
  - `CurrentStep As TaskStep` - Step corrente
  - `TaskId As String` - ID del task

---

### 6. **CompiledUtteranceTask.vb** - Task Compilato

#### `CompiledUtteranceTask` (Classe)
- **Cosa fa**: Rappresenta un task compilato per interpretazione utterance
- **Dove**: `VBNET/Compiler/DTO/Runtime/CompiledTask.vb` (linea ~79)
- **Perché studiarla**: ProcessTurn riceve CompiledUtteranceTask come parametro
- **Proprietà importanti**:
  - `Steps As List(Of DialogueStep)` - Steps del dialogo (Start, NoMatch, NoInput, Success)
  - `Constraints As List(Of ValidationCondition)` - Vincoli per validazione
  - `NlpContract As CompiledNlpContract` - Contract NLP per parsing
  - `SubTasks As List(Of CompiledUtteranceTask)` - Sub-task ricorsivi

---

### 7. **DialogueStep.vb** - Step del Dialogo

#### `DialogueStep` (Classe)
- **Cosa fa**: Rappresenta uno step del dialogo (Start, NoMatch, NoInput, Success)
- **Dove**: `VBNET/Compiler/DTO/IDE/DialogueStep.vb` (linea ~9)
- **Perché studiarla**: ProcessTurn deve navigare tra gli step
- **Proprietà importanti**:
  - `Type As DialogueState` - Tipo di step (Start, NoMatch, NoInput, Success)
  - `Escalations As List(Of Escalation)` - Escalation per questo step
  - **Nota**: Escalation contiene Tasks (MessageTask, CloseSessionTask, TransferTask)

---

### 8. **Escalation.vb** - Escalation

#### `Escalation` (Classe)
- **Cosa fa**: Rappresenta un'escalation (lista di escalation per step)
- **Dove**: `VBNET/Compiler/DTO/IDE/Escalation.vb`
- **Perché studiarla**: ProcessTurn deve selezionare l'escalation corretta basata sui counter
- **Proprietà importanti**:
  - `Tasks As List(Of ITask)` - Tasks da eseguire (MessageTask, CloseSessionTask, TransferTask)
  - **Nota**: Escalation[0] = prima escalation, Escalation[1] = seconda, ecc.

---

### 9. **MessageTask.vb** - Task Messaggio

#### `MessageTask` (Classe)
- **Cosa fa**: Rappresenta un task che invia un messaggio
- **Dove**: `VBNET/DDTEngine/Models/Tasks/MessageTask.vb` (linea ~11)
- **Perché studiarla**: ProcessTurn deve estrarre TextKey da MessageTask per risolvere traduzioni
- **Proprietà importanti**:
  - `TextKey As String` - GUID della traduzione (non testo diretto)
  - **Nota**: TextKey deve essere risolto con TranslationRepository

---

### 10. **TurnState.vb** - Enum Stato Turno

#### `TurnState` (Enum)
- **Cosa fa**: Enum che rappresenta lo stato corrente del turno
- **Dove**: `VBNET/Orchestrator/TaskEngine/Types.vb` (linea ~25)
- **Perché studiarla**: ProcessTurn deve gestire transizioni di stato
- **Valori**:
  - `Start` - Step iniziale
  - `NoMatch` - Input non riconosciuto
  - `NoInput` - Nessun input ricevuto
  - `Confirmation` - Richiesta conferma
  - `CollectingMain` - Raccolta dati principali
  - `CollectingSub` - Raccolta dati secondari
  - `Success` - Task completato
  - `NotConfirmed` - Conferma negata

---

### 11. **Counters.vb** - Contatori Escalation

#### `Counters` (Classe)
- **Cosa fa**: Contatori per escalation (NoMatch, NoInput, NotConfirmed, Confirmation)
- **Dove**: `VBNET/Orchestrator/TaskEngine/Types.vb` (linea ~150)
- **Perché studiarla**: ProcessTurn deve incrementare counter e selezionare escalation
- **Proprietà importanti**:
  - `NoMatch As Integer` - Contatore NoMatch
  - `NoInput As Integer` - Contatore NoInput
  - `NotConfirmed As Integer` - Contatore NotConfirmed
  - `Confirmation As Integer` - Contatore Confirmation

---

### 12. **CompiledTaskAdapter.vb** - Adattatore Task

#### `CreateDialogueContextFromTask(task As CompiledUtteranceTask) As DialogueContext`
- **Cosa fa**: Crea DialogueContext da CompiledUtteranceTask
- **Dove**: `VBNET/Orchestrator/TaskExecutor/CompiledTaskAdapter.vb` (linea ~15)
- **Perché studiarla**: Capire come viene creato DialogueContext iniziale
- **Cosa fa**: Converte CompiledUtteranceTask.Steps in TaskStep e crea DialogueContext

---

## 📚 Ordine di Studio Consigliato

1. **DialogueState** e **DialogueContext** - Capire la struttura dello stato
2. **CompiledUtteranceTask** e **DialogueStep** - Capire la struttura del task
3. **MessageTask** e **Escalation** - Capire come estrarre messaggi
4. **SessionManager** - Capire come caricare/salvare stato
5. **DialogRepository** e **TranslationRepository** - Capire come caricare dati
6. **TurnState** e **Counters** - Capire la logica di escalation

---

## 🔍 Domande Chiave da Rispondere

Dopo aver studiato queste routine, dovresti essere in grado di rispondere a:

1. Come viene caricato DialogueState dalla sessione?
2. Come viene salvato DialogueState nella sessione?
3. Come viene caricato CompiledUtteranceTask dal repository?
4. Come vengono risolte le traduzioni (TextKey -> testo)?
5. Come vengono estratti i messaggi da DialogueStep/Escalation/MessageTask?
6. Come funzionano i counter per escalation?
7. Come viene selezionata l'escalation corretta basata sui counter?

---

## 📝 Note Importanti

- **Stateless**: Tutto lo stato è in Redis, non in memoria
- **Repository Pattern**: DialogRepository e TranslationRepository sono interfacce, implementazione Redis
- **Serializzazione**: DialogueContext viene serializzato in JSON per Redis
- **Cache**: Repository usano cache in memoria per performance
- **GUID**: TextKey è sempre un GUID, mai testo diretto

---

## 🚀 Prossimo Passo

Dopo aver studiato queste routine, implementeremo:
1. `ProcessTurnEngine.vb` - Funzione ProcessTurn
2. `ProcessTurnHandlers.vb` - Endpoint /api/runtime/process-turn
