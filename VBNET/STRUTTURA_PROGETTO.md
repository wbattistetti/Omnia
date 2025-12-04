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
├── DDTEngine.Core/                    # Core del motore
│   ├── DDTEngine.Core.vbproj          # File di progetto
│   ├── Models/                        # Classi di modello
│   │   ├── DDTInstance.vb             # Istanza di DDT
│   │   ├── DDTNode.vb                 # Nodo del DDT (mainData o subData)
│   │   ├── Response.vb                # Response del dialogo
│   │   ├── ParseResult.vb             # Risultato del parsing
│   │   └── ValidationCondition.vb    # Condizione di validazione
│   ├── Engine/                        # Logica del motore
│   │   ├── DDTEngine.vb               # Classe principale (Execute)
│   │   ├── DataRetriever.vb           # GetNextData
│   │   ├── ResponseManager.vb         # GetResponse, ExecuteResponse
│   │   ├── Parser.vb                  # InterpretUtterance
│   │   └── StateManager.vb            # SetState
│   └── Helpers/                       # Funzioni helper
│       └── MemoryManager.vb           # Gestione memory centralizzata
│
├── DDTEngine.TestUI/                  # Interfaccia Windows Forms per test
│   ├── DDTEngine.TestUI.vbproj        # File di progetto
│   ├── MainForm.vb                    # Form principale con chat
│   └── Program.vb                     # Entry point
│
└── TestData/                          # DDT di esempio
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

### ✅ Completato

- Struttura base del progetto
- Classi Models complete
- Classi Engine con struttura base
- MemoryManager base
- Interfaccia TestUI base
- DDT di esempio (DatiPersonali.json)
- Documentazione (README, ISTRUZIONI_COPILOT)

### 🚧 Da Implementare

1. **Parser.InterpretUtterance**: Logica completa di parsing
   - Caricamento contract
   - Gestione confirmation con correzione implicita
   - Gestione validazione
   - Match su contract in primo piano e background

2. **StateManager.SetState**: Logica completa di transizione stati
   - Gestione Match → confirmation/validation
   - Gestione Confirmed → validation
   - Gestione Validated → completed
   - Gestione Invalid → conditionId

3. **ResponseManager.ExecuteResponse**: Logica completa
   - Sostituzione placeholder {input}
   - Mostra messaggio (interfaccia)
   - Esecuzione azioni

4. **MainForm**: Interfaccia completa
   - Caricamento DDT da JSON
   - Integrazione con DDTEngine
   - Visualizzazione stati dati
   - Gestione input/output

5. **ValidationHelper**: Validazione dati
   - Esecuzione validationConditions
   - Gestione regex, range, custom

6. **Contract System**: Sistema di estrazione
   - Caricamento contract per nodo
   - Caricamento contract di background
   - Estrazione dati (regex/rules/NER/LLM)

## Prossimi Passi

1. Aprire il progetto in Visual Studio
2. Implementare le funzioni TODO
3. Testare con DatiPersonali.json
4. Debug e raffinamento
5. Aggiungere test unitari

## Riferimenti

- `../documentation/Motori.MD` - Specifica completa del DDT Engine
- `README.md` - Panoramica del progetto
- `ISTRUZIONI_COPILOT.md` - Istruzioni per il Copilot
- `TestData/DatiPersonali.json` - DDT di esempio

## Note

- Tutti i file VB.NET usano `Option Strict On` e `Option Explicit On`
- Il progetto usa .NET 6.0
- La solution include due progetti: Core e TestUI
- Il TestUI ha riferimento al Core






