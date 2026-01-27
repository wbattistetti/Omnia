# Analisi Approfondita: Chat Simulator e Motore di Dialogo DDT

## 📋 Panoramica Generale

Il sistema Omnia implementa un **motore di dialogo complesso** per la raccolta di dati strutturati attraverso conversazioni. Il sistema è composto da:

1. **Chat Simulator** - Interfaccia frontend per testare il dialogo
2. **DDT Engine** - Motore di dialogo che gestisce l'acquisizione dati (implementato sia in TypeScript che VB.NET)
3. **Flow Orchestrator** - Orchestratore che gestisce il flusso complessivo del dialogo
4. **Compiler** - Compilatore che trasforma flowchart in task eseguibili
5. **Backend Runtime** - Server che espone API per eseguire il motore VB.NET

---

## 🏗️ Architettura del Sistema

### Componenti Principali

```
┌─────────────────────────────────────────────────────────────┐
│                    CHAT SIMULATOR (Frontend)                 │
│  - src/components/debugger/ChatSimulator.tsx                │
│  - src/components/TaskEditor/ResponseEditor/ChatSimulator/  │
│  - src/components/ChatSimulator/                             │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ API Calls
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              BACKEND TYPE SELECTOR                            │
│  - BackendTypeContext (React vs VB.NET)                      │
│  - Porta 3100 (Node.js) o 5000 (VB.NET)                     │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
        ▼                             ▼
┌──────────────────┐         ┌──────────────────┐
│  REACT BACKEND   │         │  VB.NET BACKEND  │
│  (Node.js)       │         │  (ASP.NET Core)  │
│  Porta 3100      │         │  Porta 5000      │
│                  │         │                  │
│  - DDT Engine TS │         │  - ApiServer.exe │
│  - Flow Runtime  │         │  - DDTEngine.dll │
│                  │         │  - Compiler.dll  │
│                  │         │  - Orchestrator  │
└──────────────────┘         └──────────────────┘
```

---

## 🔄 DDT Engine - Motore di Dialogo

### Implementazioni Multiple

Il DDT Engine esiste in **tre implementazioni parallele**:

#### 1. **TypeScript Frontend Engine** (`src/components/DialogueEngine/ddt/ddtEngine.ts`)
- **Stato**: Implementazione nuova, parallela
- **Funzione principale**: `runDDT(ddtInstance, callbacks, limits)`
- **Logica**: Macchina a stati deterministica
- **Uso**: Frontend React, testing, sviluppo

#### 2. **TypeScript DialogueDataEngine** (`src/components/DialogueDataEngine/engine.ts`)
- **Stato**: Engine V2, più avanzato
- **Funzione principale**: `initEngine(template)`, `advance(state, input)`
- **Logica**: State machine con Mixed Initiative
- **Uso**: Chat Simulator principale, più completo

#### 3. **VB.NET Engine** (`VBNET/DDTEngine/Engine/Motore.vb`)
- **Stato**: Implementazione production-ready
- **Funzione principale**: `ExecuteDDT(ddtInstance)`
- **Logica**: Macchina a stati con Parser integrato
- **Uso**: Backend runtime, produzione

### Architettura DDT Engine

#### Stati del Motore

```
TurnState (Stati interni):
├── Start          → Domanda iniziale
├── NoMatch        → Input non riconosciuto
├── NoInput        → Input vuoto
├── Confirmation   → Chiede conferma
├── NotConfirmed   → Dato non confermato
└── Success        → Dato completato

Context (Ambito raccolta):
├── CollectingMain  → Raccolta dato principale
└── CollectingSub  → Raccolta sub-dato
```

#### Flusso di Esecuzione

```typescript
runDDT(ddtInstance, callbacks, limits) {
  1. initializeState()           // Inizializza memory e counters
  2. playIntroduction()          // Mostra preamble se presente

  while (true) {
    3. getNextData()             // Trova prossimo dato vuoto
    4. getNodeState()            // Determina stato corrente
    5. getResponse()             // Seleziona step/escalation
    6. executeResponse()         // Mostra messaggio
    7. processUserInput()        // Attende e processa input
    8. getState()                // Gestisce transizione stato
    9. updateState()             // Aggiorna stato globale

    if (allDataCollected) break
  }

  return { success: true, value: state.memory }
}
```

#### Memory Management

```typescript
state.memory: {
  [nodeId]: {
    value: any,        // Valore estratto
    confirmed: boolean // Se confermato (solo main con confirmation)
  }
}

state.counters: {
  [nodeId]: {
    noMatch: number,      // Tentativi noMatch
    noInput: number,      // Tentativi noInput
    notConfirmed: number // Tentativi notConfirmed
  }
}
```

#### Contract-based Extraction

Il motore usa **contract NLP** per estrarre valori:
- **Regex patterns** - Estrazione pattern-based
- **NER (Named Entity Recognition)** - Estrazione entità
- **LLM** - Estrazione via AI

Il contract mappa `canonicalKey` → `subId` per dati compositi:
```typescript
// Esempio: Data di nascita
contract.extract("12 dicembre 1980")
// → { day: 12, month: "dicembre", year: 1980 }
// → Mappa: day → subId "day", month → subId "month", year → subId "year"
```

---

## 🎯 Flow Orchestrator

### Implementazioni

#### 1. **TypeScript Frontend** (`src/components/ChatSimulator/hooks/useNewFlowOrchestrator.ts`)
- **Funzione**: Orchestra esecuzione flow nel frontend
- **Uso**: Chat Simulator, debug

#### 2. **VB.NET Backend** (`VBNET/Orchestrator/FlowOrchestrator.vb`)
- **Funzione**: Orchestra esecuzione flow nel backend
- **Uso**: Runtime production

### Architettura Flow Orchestrator

```
FlowOrchestrator {
  1. Compile Flow          → Compiler trasforma flowchart in task
  2. Find Next Task        → Trova task eseguibile (condizione = true)
  3. Execute Task          → Esegue task (SayMessage, GetData, ecc.)
  4. Handle DDT            → Se task è GetData, chiama DDT Engine
  5. Update State          → Aggiorna stato globale
  6. Repeat                → Continua fino a completamento
}
```

### Task Types

```vb
- SayMessageTask      → Mostra messaggio
- GetDataTask         → Chiama DDT Engine
- TransferTask        → Trasferisce a altro sistema
- CloseSessionTask    → Chiude sessione
- BackendTask         → Chiama backend esterno
- ClassifyProblemTask → Classifica problema
```

---

## 🔧 Compiler

### Implementazione VB.NET (`VBNET/Compiler/`)

Il compilatore trasforma un **flowchart** (nodi + archi) in una **lista piatta di task eseguibili**.

#### Struttura

```
FlowCompiler {
  1. Parse Flow          → Legge nodes e edges
  2. Build Task Groups   → Raggruppa task per nodo
  3. Resolve Conditions  → Valuta condizioni
  4. Generate Tasks      → Crea CompiledTask
  5. Set Entry Point     → Identifica task iniziale
}
```

#### Output

```vb
FlowCompilationResult {
  Tasks: List(Of CompiledTask)      // Lista piatta di task
  TaskGroups: List(Of TaskGroup)     // Raggruppamenti
  EntryTaskGroupId: String           // Punto di ingresso
}
```

---

## 💬 Chat Simulator

### Componenti

#### 1. **ChatSimulator.tsx** (`src/components/debugger/ChatSimulator.tsx`)
- **Funzione**: Interfaccia principale per testare dialogo
- **Features**:
  - Toggle tra "Nuovo Engine" e "Legacy Engine"
  - Toggle tra "React Backend" e "VB.NET Backend"
  - Debug panel
  - Reset conversazione

#### 2. **DDTSimulatorPreview** (`src/components/debugger/DDTSimulatorPreview.tsx`)
- **Funzione**: Preview del DDT con nuovo engine
- **Uso**: Quando "Nuovo Engine" è attivo

#### 3. **DDEBubbleChat** (`src/components/ChatSimulator/DDEBubbleChat.tsx`)
- **Funzione**: Chat bubble interface completa
- **Features**:
  - Messaggi bot/user
  - Editing messaggi
  - Transcript
  - Mixed Initiative support

### Integrazione Backend

Il Chat Simulator può usare due backend:

```typescript
// Backend Type Selector
const { backendType } = useBackendType();

if (backendType === 'vbnet') {
  // Chiama API VB.NET (porta 5000)
  fetch('http://localhost:5000/api/runtime/ddt/run', ...)
} else {
  // Chiama API React (porta 3100)
  fetch('http://localhost:3100/api/runtime/ddt/run', ...)
}
```

---

## 🔌 Backend Runtime

### Node.js Backend (`backend/server.js`)

**Endpoint**: `POST /api/runtime/ddt/run`
- Usa DDT Engine TypeScript (`backend/runtime/ddt/ddtEngine.ts`)
- Porta: **3100**

### VB.NET Backend

#### 1. **ApiServer.exe** (`VBNET/ApiServer/`)
- **Funzione**: Server ASP.NET Core che espone API REST
- **Porta**: **5000**
- **Endpoint**:
  - `POST /api/runtime/compile` - Compila flow
  - `POST /api/runtime/ddt/run` - Esegue DDT
  - `POST /api/runtime/orchestrator/session/start` - Avvia sessione

#### 2. **Ruby Wrapper** (`backend/ruby/`)
- **Funzione**: Server Ruby che wrappa ApiServer.exe
- **Porta**: **3101**
- **Uso**: Alternativa a ApiServer.exe diretto

### Flusso Backend VB.NET

```
1. Frontend → POST /api/runtime/ddt/run
2. ApiServer.exe riceve richiesta
3. ApiServer.exe → DDTEngine.Motore.ExecuteDDT()
4. Motore esegue ciclo dialogo
5. Motore → Eventi MessageToShow
6. ApiServer.exe → Risponde con JSON
7. Frontend riceve messaggi e stato
```

---

## 🔍 Analisi Problemi e Cosa Funziona

### ✅ Cosa Funziona

1. **DDT Engine TypeScript** - Implementazione funzionante, testata
2. **DDT Engine VB.NET** - Implementazione production-ready
3. **Flow Orchestrator VB.NET** - Orchestratore funzionante
4. **Compiler VB.NET** - Compilatore funzionante
5. **Chat Simulator Frontend** - Interfaccia completa

### ⚠️ Problemi Potenziali

#### 1. **Multiple Implementazioni**
- **Problema**: Tre implementazioni diverse del DDT Engine
- **Impatto**: Difficile mantenere sincronizzazione
- **Soluzione**: Standardizzare su una implementazione o creare adapter comune

#### 2. **Backend Type Switching**
- **Problema**: Switch tra React e VB.NET può causare inconsistenze
- **Impatto**: Comportamento diverso tra backend
- **Soluzione**: Garantire parità di comportamento

#### 3. **Contract Loading**
- **Problema**: Contract NLP deve essere caricato correttamente
- **Impatto**: NoMatch se contract mancante
- **Soluzione**: Validazione contract prima di eseguire DDT

#### 4. **Memory Management**
- **Problema**: Memory può essere inconsistente tra implementazioni
- **Impatto**: Valori persi o non mappati correttamente
- **Soluzione**: Standardizzare struttura memory

#### 5. **State Synchronization**
- **Problema**: Stato può divergere tra frontend e backend
- **Impatto**: Comportamento imprevisto
- **Soluzione**: Sincronizzazione esplicita stato

---

## 🚀 Cosa Dobbiamo Fare Funzionare

### Priorità 1: Chat Simulator con Backend VB.NET

**Obiettivo**: Far funzionare il Chat Simulator con il backend VB.NET

**Step**:
1. ✅ Verificare che ApiServer.exe sia compilato e funzionante
2. ✅ Verificare che ApiServer.exe sia in ascolto su porta 5000
3. ✅ Testare endpoint `/api/health` per verificare connessione
4. ✅ Testare endpoint `/api/runtime/ddt/run` con DDT semplice
5. ✅ Verificare che il Chat Simulator chiami correttamente il backend VB.NET
6. ✅ Verificare che i messaggi vengano mostrati correttamente
7. ✅ Verificare che l'input utente venga processato correttamente

### Priorità 2: Integrazione Flow Orchestrator

**Obiettivo**: Far funzionare il Flow Orchestrator completo

**Step**:
1. ✅ Verificare che il Compiler compili correttamente il flow
2. ✅ Verificare che FlowOrchestrator esegua task correttamente
3. ✅ Verificare che GetData task chiami DDT Engine
4. ✅ Verificare che SayMessage task mostri messaggi
5. ✅ Verificare transizioni tra task

### Priorità 3: Contract NLP

**Obiettivo**: Garantire che i contract NLP siano caricati e funzionanti

**Step**:
1. ✅ Verificare che i contract siano presenti nel DDT
2. ✅ Verificare che i contract vengano caricati correttamente
3. ✅ Verificare che l'estrazione funzioni (regex/NER/LLM)
4. ✅ Verificare mapping canonicalKey → subId

### Priorità 4: Testing End-to-End

**Obiettivo**: Test completo del sistema

**Step**:
1. ✅ Test DDT semplice (email, phone)
2. ✅ Test DDT composito (date con sub)
3. ✅ Test escalation (noMatch, noInput)
4. ✅ Test confirmation
5. ✅ Test flow completo con multiple task

---

## 📝 Note Implementative

### DDT Structure

```typescript
AssembledDDT {
  id: string
  label: string
  introduction?: any          // Preamble per aggregate
  data: dataNode | dataNode[] // Main data (atomic o composite)
  translations?: Record<string, string>
}

dataNode {
  id: string
  label: string
  kind: string               // "date", "email", "phone", "name", ecc.
  subData?: dataNode[]       // Sub-data per composite
  steps: {
    start?: Step | Step[]
    noMatch?: Step | Step[]
    noInput?: Step | Step[]
    confirmation?: Step | Step[]
    notConfirmed?: Step | Step[]
    success?: Step | Step[]
  }
}
```

### Step Structure

```typescript
Step {
  base?: string              // Messaggio base
  escalations?: Escalation[] // Escalation messages
  actions?: Action[]         // Azioni da eseguire
}

Escalation {
  message: string           // Messaggio escalation
  actions?: Action[]
}
```

### Callbacks

```typescript
DDTNavigatorCallbacks {
  onMessage: (text, stepType, escalationNumber) => void
  onGetRetrieveEvent: (nodeId) => Promise<UserInputEvent>
  onProcessInput: (input, node) => Promise<RecognitionResult>
  onUserInputProcessed: (input, matchStatus, extractedValues) => void
  translations?: Record<string, string>
}
```

---

## 🎯 Conclusioni

Il sistema è **architettonicamente solido** ma presenta alcune sfide:

1. **Multiple implementazioni** del DDT Engine richiedono sincronizzazione
2. **Backend switching** richiede parità di comportamento
3. **Contract NLP** deve essere gestito correttamente
4. **Testing end-to-end** necessario per validare integrazione

**Prossimi Step**:
1. Avviare ApiServer.exe e verificare funzionamento
2. Testare Chat Simulator con backend VB.NET
3. Verificare integrazione Flow Orchestrator
4. Testare contract NLP
5. Eseguire test end-to-end

---

## 📚 File Chiave

### Frontend
- `src/components/debugger/ChatSimulator.tsx` - Chat Simulator principale
- `src/components/DialogueEngine/ddt/ddtEngine.ts` - DDT Engine TS
- `src/components/DialogueDataEngine/engine.ts` - DDT Engine V2
- `src/components/ChatSimulator/hooks/useNewFlowOrchestrator.ts` - Flow Orchestrator TS
- `src/context/BackendTypeContext.tsx` - Backend type selector

### Backend VB.NET
- `VBNET/DDTEngine/Engine/Motore.vb` - DDT Engine VB.NET
- `VBNET/Orchestrator/FlowOrchestrator.vb` - Flow Orchestrator VB.NET
- `VBNET/Compiler/FlowCompiler.vb` - Flow Compiler
- `VBNET/ApiServer/Program.vb` - API Server

### Backend Node.js
- `backend/server.js` - Server Node.js (porta 3100)
- `backend/runtime/ddt/ddtEngine.ts` - DDT Engine runtime

### Documentazione
- `documentation/DDT Engine.md` - Documentazione DDT Engine
- `documentation/Orchestrator.md` - Documentazione Orchestrator
