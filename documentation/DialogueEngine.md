Progetto Motore Conversazionale DDT con Debugger Avanzato

✅ Obiettivo

Costruire un motore conversazionale modulare, testabile e altamente estendibile per la simulazione di DDT (Dialogue Data Template), integrato con un debugger visuale interattivo in React. Tutto deve essere trasportabile in Cursor/React semplicemente copiando una cartella senza dipendenze non standard.

📁 Struttura delle Cartelle

src/components/SimulatorEngine/
├── index.ts             // Export pubblico
├── engine.ts            // Logica pura e stateless
├── useSimulator.ts      // Hook React principale
├── types.ts             // Tipi TypeScript condivisi
├── constraintRunner.ts  // Esecuzione sicura dei constraint
├── messageResolver.ts   // Traduzioni e placeholder
├── escalation.ts        // Gestione escalation
├── state.ts             // Helpers per la gestione dello stato
├── utils.ts             // Helpers generici
├── useCaseGenerator.ts  // Generazione automatica use cases (vedi sotto)
├── __tests__/           // Test unitari
│   ├── engine.test.ts
│   ├── constraintRunner.test.ts
│   └── messageResolver.test.ts

🧱 Moduli e Responsabilità

types.ts

Interfacce: DDT, UseCase, TranslationMap, Action, Constraint, Escalation, SimulatorState, Subdata

Supporto per:

Step condizionali (condition?)

Escalation condizionali

Subdata e stati annidati

Step multipli per escalation e recovery

engine.ts

Funzioni:

initEngine(ddt, useCase, translations)

advance(state, input)

reset(state)

loadUseCase(state, useCase)

Stateless, senza React

Gestione escalation, constraint, subdata, step condizionali, dati saturati, tentativi

useSimulator.ts

Hook React che incapsula engine.ts

Usa useState o useReducer

Espone:

state, next(), reset(), setManualInput(), loadUseCase()

constraintRunner.ts

runConstraint(script, variables) in sandbox

try/catch, logging errori, validazione sicura

messageResolver.ts

Risolve chiavi da translations (multi-lingua)

Sostituzione placeholder con variabili ({dateOfBirth} → 1990-01-01)

escalation.ts

Valutazione condizioni dinamiche sulle escalation

Supporto fallback o override

state.ts

Helpers per:

Step corrente

Variabili raccolte

Tentativi

Stato subdialoghi (ricorsivo)

Verifica saturazione dati

utils.ts

deepClone, safeGet, ecc.

🤖 useCaseGenerator.ts – Generatore automatico di UseCases

Funzione principale:

generateUseCases(ddt, translations, options?): GeneratedUseCase[]

UseCase generati:

Happy Path (step lineari, completamento senza errori)

Error Handling (recuperati):

NoMatch con conferma successiva

NoInput recuperato

Constraint violato ma poi corretto

Error Handling (non recuperati)

Subdata incomplete:

Date con solo anno, solo mese, giorno mancante, ecc.

UseCase condizionali:

Step ed escalation che dipendono da condition: string

Output UseCase:

{
  id: "ErroreNoMatch",
  label: "Errore iniziale e recupero",
  dotName: "DataDiNascita.Start.NoMatch.1.Confirmation.Success",
  steps: ["Start", "NoMatch.1", "Confirmation", "Success"],
  inputs: ["???", "1990-01-01", "Sì"],
  conversation: [ ... ]
}

🔁 Logica Avanzata del Motore

Step condizionali attivati solo se condition è vera

Escalation condizionali

Dati non saturi → attivano subdata

Ogni input utente aggiorna le variabili

Placeholder dinamici nei messaggi

📊 Modalità Debug vs. Conversation

Modalità Conversazione:

Visualizza solo bot/user bubble

Modalità Debug:

Visualizza azioni extra: callAPI, handover, logEvent, completeForm, ecc.

Ogni azione ha stato (OK, ERROR), payload ispezionabile, toggle "Vedi dettagli"

🌳 Struttura ad albero dotName (esempio Data di Nascita)

DataDiNascita
├── HappyPath
├── Error.NoMatch.Recovery
│   ├── NoMatch.1.Confirmation.Success
│   └── NoMatch.2.NoMatch.3.Failure
├── Error.NoInput.Recovery
│   └── NoInput.1.Confirmation.Success
├── Constraint.DataNelFuturo
│   ├── Violated.Once.Corrected
│   └── Violated.Repeated.Failure
├── Saturation
│   ├── YearOnly.RequestMonthDay.Confirmation.Success
│   ├── MonthYearOnly.RequestDay.Confirmation.Success
│   ├── DayMissing
│   └── MonthMissing

🧠 Integrazione Debugger UI

TreeView con struttura dotName

Pulsanti: "Happy Path", "Error Handling"

Chat simulatore WhatsApp-like

Modalità debug avanzata: azioni intermedie, payload, stato

Filtro messaggi/azioni, ricerca, evidenziazione step-by-step

✅ Estensibilità futura

Supporto a IA per generare prompt realistici (es. NoMatch volontari)

Plugin per constraint personalizzati

UI visuale per creare DDT e UseCases

Replay step-by-step, export, logging dettagliato

Conclusione

Il motore conversazionale DDT con debugger avanzato è progettato per supportare dialoghi complessi, validazioni, escalation condizionali e subdata, tutto in modo testabile, modulare e scalabile.
Il useCaseGenerator.ts permette di creare automaticamente i principali scenari di test, sia statici sia condizionali, garantendo una copertura realistica e utile per QA e sviluppo.