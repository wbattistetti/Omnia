# Struttura del Progetto DDT Engine VB.NET

## Panoramica

Questo progetto implementa il DDT Engine (DataDialogueTemplate Engine) in VB.NET, basato sulla specifica dettagliata in `../documentation/Motori.MD`.

## Struttura delle Cartelle

```
VBNET/
├── README.md                          # Panoramica generale del progetto
├── ISTRUZIONI_COPILOT.md              # Istruzioni dettagliate per il Copilot
├── STRUTTURA_PROGETTO.md              # Questo file
├── VBNET.sln                          # Solution file per Visual Studio
│
├── DDTEngine/                          # Core del motore
│   ├── TaskEngine.vbproj               # File di progetto
│   ├── Models/                        # Classi di modello
│   │   ├── TaskUtterance.vb           # Task utterance
│   │   ├── DialogueStep.vb            # Step del dialogo
│   │   ├── ParseResult.vb             # Risultato del parsing
│   │   └── ValidationCondition.vb    # Condizione di validazione
│   ├── StatelessEngine/                # Motore stateless
│   │   ├── StatelessDialogueEngine.vb # Entry point (ProcessTurn)
│   │   ├── DialogueStepApplier.vb     # Applica step
│   │   ├── TaskNavigator.vb           # Navigazione task
│   │   ├── DataStateComputer.vb       # Calcola DataState
│   │   └── UtteranceInterpreter.vb    # Interpreta utterance
│   ├── Engine/                        # Parser e utilità
│   │   ├── Parser.vb                  # Parser utterance
│   │   └── Utils.vb                   # Utilità
│   └── Helpers/                       # Funzioni helper
│       └── TaskLoader.vb              # Caricamento task
│
├── Orchestrator/                      # Orchestratore flow
│   ├── Orchestrator.vbproj            # File di progetto
│   ├── FlowOrchestrator.vb            # Orchestratore principale
│   ├── TaskGroupExecutor.vb           # Esegue TaskGroups
│   └── TaskExecutor/                  # Executor per tipo di task
│
├── Compiler/                          # Compilatore
│   ├── Compiler.vbproj                # File di progetto
│   ├── FlowCompiler.vb                # Compila flow
│   └── TaskCompiler/                  # Compila task
│
├── ApiServer/                         # API server
│   ├── ApiServer.vbproj                # File di progetto
│   ├── SessionManager.vb              # Gestione sessioni
│   └── Interfaces/                   # Endpoint API
│
└── TestData/                          # Dati di esempio
    └── DatiPersonali.json             # DDT completo: Nome, Cognome, Indirizzo, Telefono
```

## Come Aprire il Progetto

1. Apri Visual Studio
2. File → Open → Project/Solution
3. Seleziona `VBNET/VBNET.sln`
4. Il progetto si caricherà con tutti i file

## Componenti Principali

### Models

- **DDTInstance**: Rappresenta un'istanza di DDT con mainData, introduction, successResponse
- **DDTNode**: Rappresenta un nodo (mainData o subData) con responses, validationConditions, subData
- **Response**: Rappresenta un response del dialogo con text, exitCondition, actions
- **ParseResult**: Risultato del parsing con result, extractedData, conditionId
- **ValidationCondition**: Condizione di validazione con type, parameters, errorMessage

### Engine

- **DDTEngine**: Classe principale che coordina il processo (Execute)
- **DataRetriever**: Trova il prossimo dato da recuperare (GetNextData)
- **ResponseManager**: Gestisce i response (GetResponse, ExecuteResponse)
- **Parser**: Interpreta l'input utente (InterpretUtterance)
- **StateManager**: Gestisce le transizioni di stato (SetState)

### Helpers

- **MemoryManager**: Gestisce la memory centralizzata per i dati raccolti

## Stato Attuale

### ✅ Componenti Attivi

- **StatelessDialogueEngine** - Motore stateless completo
- **FlowOrchestrator** - Orchestratore flow funzionante
- **TaskEngine** (TypeScript) - Nuovo motore resiliente ai crash
- **Compiler** - Compilazione flow e task
- **ApiServer** - API server con gestione sessioni

### ❌ Componenti Eliminati

- **DDTEngine.TestUI** - Progetto obsoleto, rimosso
- **ServerlessEngine** - Progetto deprecato, rimosso
- **Motore.vb** - Vecchio motore, rimosso

## Architettura

Per dettagli completi sull'architettura, vedere:
- `ARCHITETTURA_DIALOGO.md` - Documentazione completa architettura
- `DDTEngine/StatelessEngine/README.md` - StatelessDialogueEngine
- `backend/runtime/taskEngine/README.md` - TaskEngine TypeScript

## Riferimenti

- `../documentation/Motori.MD` - Specifica completa del DDT Engine
- `README.md` - Panoramica del progetto
- `ISTRUZIONI_COPILOT.md` - Istruzioni per il Copilot
- `TestData/DatiPersonali.json` - DDT di esempio

## Note

- Tutti i file VB.NET usano `Option Strict On` e `Option Explicit On`
- Il progetto usa .NET 8.0
- La solution include: TaskEngine, Compiler, Orchestrator, ApiServer
- TaskEngine TypeScript è in `backend/runtime/taskEngine/`






