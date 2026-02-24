# Architettura Sistema di Dialogo - Documentazione Aggiornata

## Panoramica

Il sistema di dialogo è composto da tre componenti principali che lavorano insieme:

1. **TaskEngine (TypeScript)** - Nuovo motore resiliente ai crash con microtask
2. **StatelessDialogueEngine (VB.NET)** - Motore stateless per logica di dialogo pura
3. **FlowOrchestrator (VB.NET)** - Orchestratore per navigazione topologica e coordinamento

## Architettura Generale

```
┌─────────────────────────────────────────────────────────────┐
│                    FlowOrchestrator                         │
│  - Trova TaskGroups eseguibili (ExecCondition)             │
│  - Gestisce ExecutionState globale                         │
│  - Coordina esecuzione flow                                │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────────┐
│                  TaskGroupExecutor                          │
│  - Esegue task in sequenza                                  │
│  - Gestisce CurrentRowIndex                                 │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────────┐
│                    TaskExecutor                             │
│  - Factory per executor specifici                           │
│  - Smista in base al tipo di task                          │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────────┐
│            UtteranceTaskExecutor                            │
│  - Adatta interfaccia per FlowOrchestrator                  │
│  - Delega a TaskEngine (TypeScript)                         │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────────┐
│              TaskEngine (TypeScript)                        │
│  - ExecuteTask() → smista per tipo                          │
│  - ExecuteTaskUtterance() → entrypoint utterance            │
│  - ExecuteTaskUtterancePipeline() → loop microtask           │
│  - GetNextContext() → logica pura                          │
│  - ExecuteMicrotask() → side effect isolato                 │
└─────────────────────────────────────────────────────────────┘
```

## Componenti Principali

### 1. TaskEngine (TypeScript) - Nuovo Motore Resiliente

**Location**: `backend/runtime/taskEngine/`

**Caratteristiche**:
- Resilienza ai crash tramite `StepExecutionState.microtaskIndex`
- Salvataggio dopo ogni microtask
- Ripresa precisa senza duplicazioni
- Modello di dominio semplice (senza vecchio motore)

**Metodi Principali**:
- `executeTask()` - Entry point unico, smista per tipo di task
- `executeTaskUtterance()` - Entry point per task utterance
- `executeTaskUtterancePipeline()` - Pipeline con loop microtask
- `getNextContext()` - Funzione pura, calcola prossimo contesto
- `executeMicrotask()` - Side effect isolato, async

**Pipeline**:
```
repeat
  newCtx = getNextContext(ctx)  // Logica pura

  for each microtask in newCtx.Step.Microtasks:
    if microtask.index > ctx.StepExecutionState.microtaskIndex:
      await executeMicrotask(microtask)  // Side effect
      stepState.microtaskIndex = microtask.index
      save(stepState)  // Commit microtask

  save(newCtx)  // Commit step
  ctx = newCtx
until requiresUserInput OR currentTask == null
```

### 2. StatelessDialogueEngine (VB.NET) - Logica Pura

**Location**: `VBNET/DDTEngine/StatelessEngine/`

**Caratteristiche**:
- Funzioni pure (nessun side effect)
- Immutabile (restituisce nuovo DialogueContext)
- Separazione chiara: DialogueStep, DataState, Event

**Pipeline**:
```
ProcessTurn(utterance, ctx)
  ↓
InterpretUtterance(utterance, ctx) → DialogueEvent
  ↓
ComputeDataState(ctx, taskId) → DataStateEnum
  ↓
ApplyDialogueStep(event, dataState, ctx) → (newCtx, output)
  ↓
Return (newCtx, DialogueOutput)
```

**Componenti**:
- `UtteranceInterpreter` - Interpreta utterance in DialogueEvent
- `DataStateComputer` - Calcola stato del dato
- `DialogueStepApplier` - Applica step del dialogo
- `TaskNavigator` - Navigazione tra task interni

### 3. FlowOrchestrator (VB.NET) - Orchestrazione Topologica

**Location**: `VBNET/Orchestrator/`

**Caratteristiche**:
- Navigazione topologica (TaskGroups, Edges)
- Valutazione ExecCondition
- Gestione ExecutionState globale
- Coordinamento esecuzione

**Responsabilità**:
- Trova TaskGroups eseguibili
- Esegue TaskGroups tramite TaskGroupExecutor
- Gestisce sospensione/ripresa per input asincroni
- Salva ExecutionState su Redis

**NON fa**:
- Non interpreta utterance (delega a TaskEngine)
- Non calcola DataState (delega a TaskEngine)
- Non applica logica di dialogo (delega a TaskEngine)

## Separazione delle Responsabilità

### FlowOrchestrator
- ✅ Navigazione topologica (TaskGroups, condizioni)
- ✅ Gestione ExecutionState globale
- ✅ Coordinamento esecuzione
- ❌ NON sa nulla di microtask, step, DialogueContext

### TaskEngine
- ✅ Esecuzione task con microtask
- ✅ Tracking granulare (StepExecutionState)
- ✅ Resilienza ai crash
- ✅ Logica pura (GetNextContext)
- ❌ NON naviga TaskGroups (delega a FlowOrchestrator)

### StatelessDialogueEngine
- ✅ Logica di dialogo pura (ProcessTurn)
- ✅ Calcolo DataState
- ✅ Applicazione step
- ❌ NON esegue side effects (delega a TaskEngine)

## Flusso di Esecuzione Completo

### Scenario 1: Task UtteranceInterpretation

```
1. FlowOrchestrator.ExecuteDialogueAsync()
   → Trova TaskGroup eseguibile

2. TaskGroupExecutor.ExecuteTaskGroup()
   → Esegue task in sequenza

3. UtteranceTaskExecutor.Execute()
   → Carica/Crea DialogueContext
   → Chiama TaskEngine.executeTask()

4. TaskEngine.executeTaskUtterance()
   → Avvia pipeline con loop microtask

5. TaskEngine.executeTaskUtterancePipeline()
   → Loop:
      - getNextContext() → calcola prossimo step
      - Loop microtask:
        - executeMicrotask() → esegue microtask
        - save(StepExecutionState) → commit microtask
      - save(DialogueContext) → commit step

6. Se RequiresUserInput:
   → Salva stato e sospende
   → Attende input utente
```

### Scenario 2: Input Utente Asincrono

```
1. FlowOrchestrator.ProvideUserInput(taskId, userInput)
   → Carica DialogueContext da ExecutionState

2. TaskEngine.executeTaskUtterancePipeline()
   → Riprende da StepExecutionState.microtaskIndex
   → Continua esecuzione microtask

3. Se Success:
   → Rimuove DialogueContext
   → Riprende ExecuteDialogueAsync()
```

## Resilienza ai Crash

### Meccanismo

Il TaskEngine salva `StepExecutionState` dopo ogni microtask:

```typescript
StepExecutionState {
  stepName: "AskDay",
  microtaskIndex: 2  // Ultimo microtask completato
}
```

### Scenari di Crash

1. **Crash prima di ExecuteMicrotask**
   → Riparte da quel microtask (nessuna duplicazione)

2. **Crash dopo ExecuteMicrotask ma prima di save**
   → Microtask viene rieseguito (deve essere idempotente)

3. **Crash dopo save**
   → Riparte dal microtask successivo (nessuna duplicazione)

### Implementazione

```typescript
for (microtask of step.microtasks) {
  if (microtask.index > stepState.microtaskIndex) {
    await executeMicrotask(microtask);  // Side effect
    stepState.microtaskIndex = microtask.index;
    await save(stepState);  // Commit microtask
  }
}
```

## Modello di Dati

### DialogueContext (TaskEngine)

```typescript
interface DialogueContext {
  taskId: string;
  steps: Step[];  // Da CompiledTask.Steps
  currentStepIndex: number | null;
  currentStep: Step | null;
  stepExecutionState: StepExecutionState | null;
}
```

### StepExecutionState

```typescript
interface StepExecutionState {
  stepName: string;
  microtaskIndex: number;  // -1 = nessun microtask eseguito
}
```

### ExecutionState (FlowOrchestrator)

```vb
Public Class ExecutionState
  Public Property DialogueContexts As Dictionary(Of String, String)
  ' taskId -> JSON(DialogueContext)

  Public Property ExecutedTaskIds As HashSet(Of String)
  Public Property ExecutedTaskGroupIds As HashSet(Of String)
  Public Property VariableStore As Dictionary(Of String, Object)
  Public Property CurrentNodeId As String
  Public Property CurrentRowIndex As Integer
End Class
```

## Principi Architetturali

### 1. Separazione delle Responsabilità

- **FlowOrchestrator**: Navigazione topologica, coordinamento
- **TaskEngine**: Esecuzione task, microtask, resilienza
- **StatelessDialogueEngine**: Logica di dialogo pura

### 2. Immutabilità

- `DialogueContext` è immutabile (ogni modifica crea nuovo context)
- `GetNextContext()` è funzione pura (nessun side effect)

### 3. Granularità dello Stato

- Salvataggio dopo ogni microtask (non solo dopo step)
- `StepExecutionState.microtaskIndex` per tracking preciso

### 4. Resilienza

- Ripresa precisa dopo crash
- Nessuna duplicazione di microtask
- Idempotenza dei microtask

## File Chiave

### TaskEngine (TypeScript)
- `backend/runtime/taskEngine/types.ts` - Interfacce e tipi
- `backend/runtime/taskEngine/taskEngine.ts` - Classe principale
- `backend/runtime/taskEngine/utteranceTaskExecutor.ts` - Adattatore

### StatelessDialogueEngine (VB.NET)
- `VBNET/DDTEngine/StatelessEngine/StatelessDialogueEngine.vb` - Entry point
- `VBNET/DDTEngine/StatelessEngine/DialogueStepApplier.vb` - Applica step
- `VBNET/DDTEngine/StatelessEngine/TaskNavigator.vb` - Navigazione task
- `VBNET/DDTEngine/StatelessEngine/DataStateComputer.vb` - Calcola DataState

### FlowOrchestrator (VB.NET)
- `VBNET/Orchestrator/FlowOrchestrator.vb` - Orchestratore principale
- `VBNET/Orchestrator/TaskGroupExecutor.vb` - Esegue TaskGroups
- `VBNET/Orchestrator/TaskExecutor/UtteranceTaskExecutor.vb` - Executor utterance

## Migrazione e Compatibilità

### Componenti Eliminati

- ❌ `Motore.vb` - Completamente rimosso
- ❌ `TaskUtteranceStateMachine.vb` - Rimosso
- ❌ `ServerlessEngine/` - Progetto deprecato, rimosso
- ❌ `DDTEngine.TestUI/` - Progetto obsoleto, rimosso

### Componenti Attivi

- ✅ `TaskEngine` (TypeScript) - Nuovo motore resiliente
- ✅ `StatelessDialogueEngine` (VB.NET) - Logica pura
- ✅ `FlowOrchestrator` (VB.NET) - Orchestrazione topologica

### Compatibilità

- `UtteranceTaskExecutor` mantiene interfaccia compatibile con FlowOrchestrator
- `TaskExecutionResult` rimane invariato
- FlowOrchestrator non richiede modifiche

## Note Implementative

### TaskEngine

- Usa direttamente `CompiledTask.Steps` (non ricrea vecchio motore)
- `DialogueContext` minimale (solo campi essenziali)
- `GetNextContext()` semplice (passa allo step successivo)
- `ExecuteMicrotask()` async (mantiene ordine esecuzione)

### StatelessDialogueEngine

- Funzioni pure (testabili in isolamento)
- Nessun side effect
- Immutabile (restituisce nuovo context)

### FlowOrchestrator

- Non conosce implementazione interna di TaskExecutor
- Usa solo interfaccia `TaskExecutionResult`
- Gestisce solo navigazione topologica

## Conclusioni

L'architettura attuale separa chiaramente:

1. **Orchestrazione** (FlowOrchestrator) - Navigazione topologica
2. **Esecuzione** (TaskEngine) - Esecuzione task con resilienza
3. **Logica** (StatelessDialogueEngine) - Logica di dialogo pura

Questa separazione permette:
- Testabilità (componenti isolati)
- Manutenibilità (responsabilità chiare)
- Resilienza (salvataggio granulare)
- Scalabilità (componenti indipendenti)
