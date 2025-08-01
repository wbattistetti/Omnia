Specifiche del Debugger DDT (Dialogue Data Template)
1. Introduzione
Questo documento descrive le specifiche funzionali e tecniche del componente Debugger React/TypeScript. Il suo scopo principale è fornire un'interfaccia utente (UI) visuale e interattiva per testare e analizzare l'esecuzione di DDT (Dialogue Data Template) e i relativi casi d'uso (use case).

Il debugger è progettato per essere modulare e trasportabile, consentendo l'integrazione in qualsiasi progetto React semplicemente copiando la cartella Debugger/. La sua funzione è principalmente quella di visualizzare conversazioni pre-generate o simulate, non di eseguire la logica del motore conversazionale in tempo reale.

2. Panoramica Funzionale
Il Debugger offre una visualizzazione a due colonne:

Pannello Sinistro (UseCase Tree): Mostra una struttura ad albero gerarchica dei casi d'uso (dotName). Permette di selezionare un caso d'uso per visualizzarne la simulazione. Il pannello è ridimensionabile tramite trascinamento del bordo destro.
Pannello Destro (Chat Simulator): Simula una conversazione tra bot e utente in stile WhatsApp. Supporta due modalità di visualizzazione:
Modalità Conversazione: Mostra solo i messaggi del bot e dell'utente.
Modalità Debug: Mostra anche le "azioni tecniche" (es. callAPI, setVariable) che avvengono dietro le quinte.
Controlli di Simulazione: Pulsanti per avviare la simulazione completa, riprodurre passo-passo, avanzare al passo successivo e resettare.
L'header del debugger include pulsanti di test rapido ("Happy Path", "Error Handling", "Recovery") che selezionano automaticamente un caso d'uso corrispondente.

3. Architettura Tecnica
Il debugger è una cartella Debugger/ autonoma, progettata per essere plug-and-play.


Debugger/
├── index.tsx                // Export principale del componente Debugger
├── Debugger.tsx            // Layout principale, gestione stato globale, resize
├── ChatSimulator.tsx       // Componente UI per la chat
├── UseCaseTree.tsx         // Componente UI per l'albero dei casi d'uso
├── useSimulator.ts         // Hook React per la gestione della riproduzione della conversazione
├── useCaseGenerator.ts     // Logica per la generazione automatica di use case (mock)
├── mockData.ts             // Dati di esempio (DDT, traduzioni, use cases pre-generati)
├── types.ts                // Definizioni delle interfacce TypeScript
├── ActionBubble.tsx        // Componente UI per visualizzare le azioni tecniche
Flusso Dati Generale:

Debugger.tsx carica i dati iniziali da mockData.ts e genera use case aggiuntivi tramite useCaseGenerator.ts.
Questi use case vengono passati a UseCaseTree.tsx per la visualizzazione.
Quando un utente seleziona un use case dall'albero, Debugger.tsx lo passa a useSimulator.ts.
useSimulator.ts gestisce la riproduzione degli eventi della conversazione (già pre-generati all'interno dell'oggetto UseCase) e li espone a ChatSimulator.tsx.
ChatSimulator.tsx renderizza gli eventi della conversazione, utilizzando ActionBubble.tsx per le azioni tecniche.
4. Componenti Principali e Responsabilità
Debugger.tsx
Componente radice che orchestra gli altri componenti.
Gestisce lo stato del selectedUseCase e la larghezza del pannello sinistro.
Inizializza e utilizza l'hook useSimulator.
Contiene la logica per i pulsanti di test rapido.
Responsabile del layout generale e del resize handle.
UseCaseTree.tsx
Prende in input un array di UseCase[].
Costruisce e visualizza una struttura ad albero basata sulla proprietà dotName di ogni UseCase.
Permette l'espansione/collasso dei nodi (anche con Shift+Click per espansione ricorsiva).
Al click su un nodo foglia (un UseCase), notifica il componente padre (Debugger.tsx) tramite onSelectUseCase, onPlayUseCase o onViewUseCase.
Applica colori e icone basati sulla category e subcategory del UseCase.
ChatSimulator.tsx
Prende in input un array di ConversationEvent[] (events) da visualizzare.
Gestisce la modalità di visualizzazione (conversation o debug).
Renderizza i messaggi del bot e dell'utente, e le ActionBubble per le azioni tecniche.
Fornisce i controlli per la simulazione (reset, next step, start step-by-step).
Scorre automaticamente verso il basso per mostrare i nuovi messaggi.
ActionBubble.tsx
Componente di presentazione per un singolo ConversationEvent di tipo 'action'.
Visualizza l'icona, il titolo e un riassunto dell'azione.
Permette di espandere per visualizzare i payload completi dell'azione.
Applica colori basati sul tipo di azione.
useSimulator.ts
Hook React che gestisce lo stato e la logica di riproduzione della conversazione.
Prende un DDT e Translation come input (anche se attualmente usa solo UseCase.conversation).
Espone:
events: L'array di ConversationEvent attualmente visualizzati.
currentUseCase: Il caso d'uso attualmente in simulazione.
isRunning, isPlaybackMode: Stati della simulazione.
mode: Modalità di visualizzazione (conversation o debug).
startSimulation(useCase): Avvia la simulazione mostrando l'intera conversazione immediatamente.
startStepByStepPlayback(useCase, delayMs): Avvia la riproduzione passo-passo con un ritardo.
nextStep(): Avanza al prossimo evento nella riproduzione passo-passo.
reset(): Resetta la simulazione.
setMode(mode): Cambia la modalità di visualizzazione.
mockData.ts
Contiene dati di esempio: ddt (definizione del DDT), translations (mappa delle traduzioni), e useCases (un array di UseCase pre-definiti).
Include la funzione generateConversationForUseCase che, per ogni UseCase, crea l'array conversation: ConversationEvent[] basandosi sui steps e inputs definiti. Questo è un punto chiave per l'integrazione.
useCaseGenerator.ts
Contiene funzioni (generateDefaultUseCasesFor, generateSubdataUseCases) che creano programmaticamente UseCase di esempio (es. Happy Path, errori, saturazione) basandosi sulla struttura del DDT.
Questi use case generati vengono poi arricchiti con la loro conversation tramite generateConversationForUseCase da mockData.ts.
5. Strutture Dati (Interfacce in src/Debugger/types.ts)
Le seguenti interfacce definiscono la struttura dei dati che il debugger si aspetta.


export interface DDT {
  id: string;
  variable: string; // Nome della variabile principale gestita dal DDT (es. "dateOfBirth")
  type: string;     // Tipo di dato (es. "date")
  constraints: Constraint[]; // Vincoli applicabili al dato
  steps: {          // Mappa degli step del DDT e delle azioni associate
    [key: string]: Action[];
  };
}

export interface Constraint {
  title: string;       // Titolo del vincolo (es. "Data nel passato")
  explanation: string; // Spiegazione del vincolo
  script: string;      // Script (stringa) per la valutazione del vincolo (es. "value => new Date(value) < new Date()")
  messages: string[];  // Messaggi da mostrare in caso di violazione
}

export interface Action {
  id: string;
  actionType: 'askQuestion' | 'sayMessage' | 'callAPI' | 'setVariable' | 'endConversation' | 'handoverToAgent' | 'logEvent' | 'sendEmail' | 'sendSMS' | 'playJingle' | 'cleanVariables' | 'skipStep' | 'recordData' | 'recordLabel' | 'waitForAgent' | 'readFromBackend' | 'writeToBackend' | 'assignRole';
  actionInstanceId: string; // ID dell'istanza dell'azione (usato per le traduzioni)
  parentId?: string;
  parameters?: ActionParameters; // Parametri specifici per il tipo di azione
}

export interface ActionParameters {
  // Parametri specifici per ogni actionType (vedi ActionBubble.tsx per esempi di utilizzo)
  endpoint?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: Record<string, any>;
  variableName?: string;
  value?: any;
  operatorId?: string;
  department?: string;
  priority?: 'low' | 'medium' | 'high';
  recipient?: string;
  subject?: string;
  message?: string;
  template?: string;
  audioFile?: string;
  volume?: number;
  variables?: string[];
  targetStep?: string;
  data?: Record<string, any>;
  label?: string;
  role?: string;
  permissions?: string[];
}

export type UseCaseCategory = 'happy_path' | 'error_handling_recovered' | 'error_handling_failed' | 'confirmation' | 'saturation';

export type ConversationEventType = 'botMessage' | 'userInput' | 'action';

export interface ConversationEvent {
  type: ConversationEventType; // Tipo di evento (botMessage, userInput, action)
  from?: 'bot' | 'user';       // Chi ha generato l'evento (solo per messaggi)
  step: string;                // Step del DDT in cui si verifica l'evento
  index: number;               // Indice dell'azione/messaggio all'interno dello step
  actionInstanceId?: string;   // ID dell'istanza dell'azione (se type === 'action' o 'botMessage')
  actionType?: Action['actionType']; // Tipo di azione (se type === 'action')
  text?: string;               // Testo del messaggio (se type === 'botMessage' o 'userInput')
  timestamp?: Date;            // Timestamp dell'evento
  payload?: ActionParameters;  // Payload dell'azione (se type === 'action')
}

export interface UseCase {
  id: string;         // ID univoco del caso d'uso
  label: string;      // Etichetta descrittiva per la UI
  dotName: string;    // Nome "puntato" gerarchico (es. "DataDiNascita.HappyPath")
  steps: string[];    // Sequenza di step del DDT per questo use case
  inputs: string[];   // Sequenza di input utente per questo use case
  category: UseCaseCategory; // Categoria del caso d'uso (per colorazione/icona)
  subcategory?: string;      // Sottocategoria (es. "no_match", "constraint")
  condition?: string | null; // Condizione (stringa) per use case condizionali (non usata dalla UI attuale)
  conditionSatisfied?: boolean; // Se la condizione è soddisfatta (non usata dalla UI attuale)
  conversation: ConversationEvent[]; // L'intera sequenza di eventi della conversazione
}

export interface Message extends ConversationEvent {} // Alias

export interface Translation {
  [key: string]: { // Chiave di traduzione (es. "runtime.DDT_BirthOfDate.start#1.AskBirthDate_1.text")
    it: string;    // Traduzione in italiano
    en?: string;   // Traduzione in inglese (opzionale)
  };
}

export type ViewMode = 'conversation' | 'debug';
6. Punti di Integrazione per il Motore Conversazionale Esterno
Il debugger attuale è una UI di visualizzazione che si aspetta di ricevere dati già "simulati" o "pre-calcolati" dal motore conversazionale. Non esegue la logica del DDT in tempo reale.

Il punto di integrazione cruciale è la generazione dell'array conversation: ConversationEvent[] per ogni UseCase.

Come il Motore Esterno dovrebbe Interagire:

Generazione dei UseCase: Il motore conversazionale esterno dovrebbe essere in grado di generare un array di oggetti UseCase. Ogni UseCase deve includere:

id, label, dotName, category, subcategory.
steps: La sequenza di step che il DDT attraversa per questo caso d'uso.
inputs: La sequenza di input che l'utente fornirebbe per questo caso d'uso.
conversation: ConversationEvent[]: Questo è l'output più importante. Il motore esterno deve simulare l'intera conversazione per un dato UseCase (basandosi su DDT, translations, steps, inputs) e produrre una sequenza cronologica di ConversationEvent.
Popolamento di ConversationEvent[]: Per ogni interazione (messaggio bot, input utente, azione tecnica), il motore esterno deve creare un oggetto ConversationEvent e aggiungerlo all'array conversation.

type: Fondamentale per la UI per capire come renderizzare l'evento.
'botMessage': Il bot dice qualcosa. Richiede from: 'bot', text, actionInstanceId (per la chiave di traduzione).
'userInput': L'utente digita qualcosa. Richiede from: 'user', text.
'action': Un'azione tecnica del bot. Richiede actionType, actionInstanceId, payload.
step: Indica lo step del DDT in cui si verifica l'evento.
timestamp: Consigliato per l'ordinamento e la visualizzazione.
payload: Per le azioni tecniche, deve contenere i parametri rilevanti per l'azione.
Fornire DDT e Translation: Il motore esterno dovrebbe fornire le definizioni complete di DDT e Translation che verranno utilizzate dal debugger per la generazione degli use case (tramite useCaseGenerator.ts) e per la risoluzione dei messaggi (tramite mockData.ts generateConversationForUseCase).

Esempio di Flusso di Integrazione:

Il motore esterno riceve una definizione di DDT.
Per ogni scenario di test desiderato (es. Happy Path, NoMatch, Constraint Violation):
Il motore esegue una simulazione interna del DDT con una sequenza predefinita di steps e inputs.
Durante questa simulazione, registra ogni messaggio del bot, ogni input dell'utente e ogni azione tecnica eseguita, creando un ConversationEvent per ciascuno.
Alla fine della simulazione, l'array di ConversationEvent risultante viene assegnato alla proprietà conversation di un nuovo oggetto UseCase.
L'array finale di UseCase[] viene passato al componente Debugger.tsx.
7. Limitazioni e Assunzioni Attuali
Nessuna Esecuzione in Tempo Reale: Il debugger non esegue la logica del DDT in tempo reale. Si basa su ConversationEvent[] pre-generati.
useSimulator Semplice: L'hook useSimulator attuale è un semplice riproduttore di un array di eventi. Non ha logica di stato complessa o interazione con un motore di esecuzione.
Generazione Use Case (Mock): Le funzioni in useCaseGenerator.ts e generateConversationForUseCase in mockData.ts sono implementazioni di esempio per generare dati per la UI. Un motore esterno dovrebbe sostituire o integrare queste logiche con le proprie capacità di simulazione e generazione di use case.
Placeholder Semplici: La risoluzione dei placeholder nei messaggi ({variableName}) è una semplice sostituzione di stringhe basata su un oggetto collectedValues molto basilare. Un motore più avanzato richiederà un messageResolver più robusto.
Constraint Script: Il campo script nell'interfaccia Constraint è una stringa e non viene eseguito in una sandbox sicura dal debugger stesso. È inteso come una descrizione per il motore esterno.
Dipendenze UI: Il debugger utilizza React, TypeScript e Tailwind CSS. Non ha altre dipendenze esterne non standard.
Questo documento dovrebbe fornire una base solida per l'integrazione del tuo motore conversazionale con l'attuale UI del debugger. Il punto chiave è che il debugger è un "visualizzatore" di conversazioni già simulate, quindi il motore esterno dovrà occuparsi della logica di simulazione e della generazione dell'array conversation: ConversationEvent[].