# WikiHow: Guida Completa all'Editor Visuale di Omnia

## Indice

1. [Logica del Disegno dei Nodi](#1-logica-del-disegno-dei-nodi)
2. [Euristica di Template Factory](#2-euristica-di-template-factory)
3. [ResponseEditor](#3-responseeditor)
4. [Persona & Escalation Overview](#4-persona--escalation-overview)
5. [Cognition](#5-cognition)
6. [Embeddings](#6-embeddings)
7. [Testing](#7-testing)

---

## 1. Logica del Disegno dei Nodi

### 1.1 Panoramica del Flowchart

Il **Flowchart** è l'editor visuale principale dove disegni il flusso di conversazione del bot. Ogni elemento nel flowchart rappresenta un **Task** (compito) che il bot può eseguire.

```
┌─────────────────────────────────────────┐
│         FLOWCHART EDITOR                │
│                                         │
│  [Nodo 1] ──condizione──> [Nodo 2]    │
│     │                                    │
│     └──> [Nodo 3]                       │
│                                         │
└─────────────────────────────────────────┘
```

### 1.2 Come Aggiungere un Nodo

**Metodo 1: Click su Canvas**
1. Fai click su un'area vuota del canvas
2. Appare un menu di selezione con i tipi di Task disponibili
3. Seleziona il tipo desiderato (es. "Chiedi Dati", "Messaggio", "Chiamata Backend")
4. Il nodo viene creato e posizionato nel punto del click

**Metodo 2: Drag & Drop da Sidebar**
1. Nella sidebar sinistra, trova l'azione desiderata
2. Trascina l'azione sul canvas
3. Rilascia per creare il nodo

**Metodo 3: Intellisense (Ctrl+Space)**
1. Seleziona un nodo esistente
2. Premi `Ctrl+Space` per aprire l'Intellisense
3. Digita il nome dell'azione desiderata
4. Seleziona dalla lista e il nodo viene creato/aggiornato

### 1.3 Come Aggiungere Righe Interne a un Nodo

Ogni nodo può contenere **righe** (rows) che rappresentano i dati da raccogliere o le azioni da eseguire:

**Per Nodi di Tipo "UtteranceInterpretation" (Raccolta Dati):**
1. Click sul nodo per selezionarlo
2. Nella parte inferiore del nodo, vedi un'area "Buffer Area"
3. Click sul pulsante "+" o digita direttamente nella riga vuota
4. Digita la label del dato da raccogliere (es. "Nome", "Email", "Data di nascita")
5. Premi `Enter` per confermare

**Esempio:**
```
┌─────────────────────────────┐
│  Chiedi Dati Personali      │
├─────────────────────────────┤
│  • Nome                     │
│  • Cognome                  │
│  • Email                    │
│  • Data di nascita          │
│  + [Aggiungi riga]         │
└─────────────────────────────┘
```

**Per Nodi di Tipo "SayMessage" (Messaggi):**
- Le righe rappresentano i messaggi da mostrare
- Puoi aggiungere più messaggi che verranno mostrati in sequenza

**Per Nodi di Tipo "BackendCall":**
- Le righe rappresentano i parametri da passare all'API

### 1.4 Corrispondenza Nodo ↔ Task

**Ogni nodo nel flowchart corrisponde esattamente a un Task nel sistema:**

```
Nodo nel Flowchart          →  Task nel Database
─────────────────────────────────────────────────
Label: "Chiedi nome"        →  Task { type: UtteranceInterpretation, labelKey: "ask_name" }
Righe interne              →  Task.subTasksIds[] (riferimenti ad altri Task)
Collegamenti (edges)        →  Task.conditions[] (condizioni di transizione)
```

**Struttura di un Task:**
```typescript
{
  id: "task-guid",
  type: TaskType.UtteranceInterpretation,  // Tipo di task
  templateId: "template-guid" | null,      // Template da cui deriva (se presente)
  labelKey: "ask_patient_name",            // Chiave per traduzione
  subTasksIds: ["sub-task-1", "sub-task-2"], // Sottotask (righe interne)
  steps: MaterializedStep[],               // Steps di dialogo (start, noMatch, ecc.)
  // ... altri campi
}
```

### 1.5 Spostamento di Nodi e Righe

**Spostare un Nodo:**
1. Click e tieni premuto sul nodo
2. Trascina nella nuova posizione
3. Rilascia per confermare

**Spostare una Riga tra Nodi:**
1. Click e tieni premuto sulla riga da spostare
2. Trascina la riga sul nodo di destinazione
3. Rilascia nella posizione desiderata (prima/dopo altre righe)
4. La riga viene rimossa dal nodo originale e aggiunta al nodo di destinazione

**Spostare una Riga all'interno dello stesso Nodo:**
1. Click e tieni premuto sulla riga
2. Trascina sopra o sotto altre righe nello stesso nodo
3. Rilascia per riordinare

**Nota:** Il sistema mantiene automaticamente i riferimenti tra nodi e righe durante lo spostamento.

### 1.6 Riordinamento dei Nodi

**Metodo 1: Drag & Drop Manuale**
- Trascina i nodi per riordinarli visivamente
- L'ordine visivo non influisce sulla logica di esecuzione (determinata dalle condizioni)

**Metodo 2: Allineamento Automatico**
- Seleziona più nodi (Ctrl+Click)
- Usa il menu di selezione per allineare/distribuire i nodi
- Opzioni disponibili:
  - Allinea a sinistra/destra/centro
  - Distribuisci verticalmente/orizzontalmente
  - Allinea alla griglia

### 1.7 Costruzione di Condizioni sui Link

I **link** (edges) tra nodi possono avere **condizioni** che determinano quando il bot passa da un nodo all'altro:

**Aggiungere una Condizione:**
1. Crea un link tra due nodi (trascina dal handle di output del nodo sorgente al nodo destinazione)
2. Click sul link per selezionarlo
3. Appare un menu con opzioni:
   - **Sempre** (nessuna condizione - transizione sempre attiva)
   - **Se [variabile] = [valore]** (condizione semplice)
   - **Se [variabile] contiene [valore]** (condizione di contenuto)
   - **Se [variabile] >/< [valore]** (condizione numerica)
   - **Editor Condizioni** (per condizioni complesse)

**Esempio di Condizione:**
```
[Nodo: Chiedi Età] ──Se età >= 18──> [Nodo: Maggiorenne]
                    └─Se età < 18──> [Nodo: Minorenne]
```

**Editor Condizioni Avanzato:**
1. Click su "Editor Condizioni" nel menu del link
2. Si apre l'editor con:
   - Variabili disponibili (dati raccolti finora)
   - Operatori logici (AND, OR, NOT)
   - Funzioni (contains, equals, greaterThan, ecc.)
3. Costruisci la condizione usando l'interfaccia visuale
4. Salva per applicare

**Struttura di una Condizione:**
```typescript
{
  type: "condition",
  variable: "age",           // Nome della variabile
  operator: ">=",            // Operatore
  value: 18,                 // Valore di confronto
  logicalOperator: "AND" | "OR" | null  // Operatore logico con altre condizioni
}
```

### 1.8 Interpretazione del Grafo per Generare TaskTree

Il sistema converte automaticamente il grafo del flowchart in un **TaskTree** (albero di task) che il runtime può eseguire:

**Processo di Conversione:**

1. **Traversamento del Grafo:**
   - Partendo dal nodo iniziale (Start), il sistema visita tutti i nodi raggiungibili
   - Per ogni nodo, crea un Task corrispondente
   - Mantiene i riferimenti tra nodi tramite `subTasksIds[]`

2. **Costruzione della Gerarchia:**
   ```
   Nodo Root: "Chiedi Dati Personali"
   ├── SubTask 1: "Nome"
   ├── SubTask 2: "Cognome"
   └── SubTask 3: "Email"
   ```

3. **Risoluzione delle Condizioni:**
   - Le condizioni sui link vengono convertite in `Task.conditions[]`
   - Il runtime valuterà queste condizioni durante l'esecuzione

4. **Generazione del TaskTree:**
   ```typescript
   TaskTree {
     labelKey: "ask_personal_data",
     nodes: TaskTreeNode[],      // Struttura gerarchica
     steps: MaterializedStep[],  // Steps di dialogo materializzati
     constraints: [],             // Vincoli sui dati
     dataContract: {}            // Contratto semantico
   }
   ```

**Esempio Completo:**
```
Flowchart:
  [Start] ──> [Chiedi Nome] ──> [Chiedi Email] ──> [Fine]

TaskTree generato:
  {
    nodes: [
      { id: "start", type: "start" },
      {
        id: "ask_name",
        type: "UtteranceInterpretation",
        subNodes: [
          { id: "name_field", label: "Nome" }
        ]
      },
      {
        id: "ask_email",
        type: "UtteranceInterpretation",
        subNodes: [
          { id: "email_field", label: "Email" }
        ]
      }
    ],
    steps: [...]  // Steps materializzati per ogni nodo
  }
```

---

## 2. Euristica di Template Factory

### 2.1 Panoramica del Sistema Euristico

Il sistema usa **euristiche intelligenti** per analizzare le label dei nodi e proporre automaticamente **Template** dalla Factory (libreria di template predefiniti).

**Flusso Euristico:**
```
Label Nodo → Euristica 1 → Euristica 2 → Euristica 3 → Template Proposto
```

### 2.2 Analisi del Grafo

Quando aggiungi o modifichi una riga in un nodo, il sistema:

1. **Cattura la Label:**
   - Prende il testo digitato nella riga (es. "Chiedi data di nascita")
   - Normalizza il testo (rimuove articoli, preposizioni, stopwords)

2. **Analizza il Contesto:**
   - Verifica il tipo di nodo (UtteranceInterpretation, SayMessage, ecc.)
   - Controlla le righe già presenti nel nodo
   - Considera la posizione nel grafo

### 2.3 Euristica 1: Identificazione Tipo Agente

**Obiettivo:** Determinare il tipo di Task necessario analizzando la label.

**Processo:**
1. **Pattern Matching:**
   - Analizza l'inizio della label per pattern comuni:
     - "Chiedi", "Richiedi", "Acquisisci" → `UtteranceInterpretation` (raccolta dati)
     - "Invia", "Mostra", "Dì" → `SayMessage` (messaggio)
     - "Chiama", "Esegui", "API" → `BackendCall` (chiamata backend)
     - "Classifica", "Identifica" → `ClassifyProblem` (classificazione)

2. **Analisi Semantica:**
   - Usa modelli NLP per capire l'intento semantico
   - Supporta multiple lingue (IT, EN, PT)
   - Considera sinonimi e varianti

3. **Risultato:**
   ```typescript
   {
     taskType: TaskType.UtteranceInterpretation,
     confidence: 0.95,
     lang: "IT"
   }
   ```

**Esempi:**
- "Chiedi il nome" → `UtteranceInterpretation` (confidence: 0.98)
- "Invia email di conferma" → `SayMessage` (confidence: 0.92)
- "Verifica disponibilità prodotto" → `BackendCall` (confidence: 0.85)

### 2.4 Euristica 2: Match Template Factory

**Obiettivo:** Trovare un template esistente nella Factory che corrisponde alla label.

**Processo:**

1. **Normalizzazione:**
   ```typescript
   "Chiedi la data di nascita del paziente"
   → "data nascita"  // Rimossi: articoli, preposizioni, "paziente"
   ```

2. **Ricerca Template:**
   - Cerca tra tutti i template della Factory
   - Confronta label normalizzate
   - Usa sinonimi euristici dal database
   - Supporta match esatto e match fuzzy (parole chiave)

3. **Scoring:**
   - **Match Esatto:** score = 100
   - **Match Parole Chiave:** score basato su:
     - Token esatti: +3 punti
     - Token parziali: +1 punto
     - Token mancanti: -5 punti
     - Bonus frase completa: +2 punti

4. **Selezione:**
   - Ordina per: tipo match (exact > keywords) → score → priorità (atomic > composite) → lunghezza label
   - Scegli il template con score più alto

**Esempio:**
```
Label: "Chiedi data di nascita"
Template trovati:
  1. "Data di Nascita" (exact match, score: 100) ✅
  2. "Data Nascita Paziente" (keywords match, score: 85)
  3. "Informazioni Anagrafiche" (keywords match, score: 45)
```

### 2.5 Euristica 3: Inferenza Categoria Semantica

**Obiettivo:** Dedurre la categoria semantica per template DataRequest.

**Processo:**
1. **Pattern Matching:**
   - Usa pattern compilati dal database (Heuristics["CategoryExtraction"])
   - Testa pattern in ordine di priorità linguistica (IT → EN → PT)

2. **Categorie Supportate:**
   - `education` (corso di studi, laurea, ecc.)
   - `personalData` (nome, cognome, anagrafica)
   - `contact` (email, telefono)
   - `location` (indirizzo, città)
   - `employment` (lavoro, azienda)
   - `finance` (carta di credito, IBAN)
   - `health` (patologie, farmaci)
   - `other` (default)

3. **Risultato:**
   ```typescript
   {
     inferredCategory: "personalData",
     confidence: 0.90
   }
   ```

### 2.6 Proposta Template

Quando l'euristica trova un template corrispondente:

1. **Dialog di Preview:**
   ```
   ┌─────────────────────────────────────┐
   │  Template Trovato                   │
   ├─────────────────────────────────────┤
   │  📋 Data di Nascita                 │
   │                                     │
   │  Struttura:                         │
   │  • Data di Nascita                  │
   │    - Giorno                         │
   │    - Mese                           │
   │    - Anno                           │
   │                                     │
   │  [Usa Template] [Crea Nuovo]        │
   └─────────────────────────────────────┘
   ```

2. **Opzioni Utente:**
   - **"Usa Template":** Clona il template e crea l'istanza
   - **"Crea Nuovo":** Apre il wizard AI per creare un nuovo template
   - **"Annulla":** Mantiene il nodo senza template

### 2.7 Conferma Template e Apertura ResponseEditor

**Quando l'utente conferma il template:**

1. **Clonazione Template:**
   ```typescript
   // Template originale (Factory)
   {
     id: "template-guid",
     labelKey: "ask_birthdate",
     type: TaskType.UtteranceInterpretation,
     steps: { start: {...}, noMatch: {...} },
     // ...
   }

   // Istanza clonata (Progetto)
   {
     id: "instance-guid",           // Nuovo GUID
     templateId: "template-guid",  // Riferimento al template
     templateVersion: 1,            // Versione del template
     labelKey: "ask_birthdate",    // Stesso labelKey
     steps: MaterializedStep[],    // Steps materializzati con nuovi GUID
     // ...
   }
   ```

2. **Materializzazione Steps:**
   - Ogni step del template viene clonato con nuovo GUID
   - Mantiene `templateStepId` per riferimento al template originale
   - Escalations vengono clonate con nuovi task IDs

3. **Apertura Automatica ResponseEditor:**
   - Il ResponseEditor si apre automaticamente
   - Mostra la struttura del template clonato
   - Permette di modificare steps, escalations, messaggi

**Se nessun template viene trovato:**
- Si apre il **Wizard AI** per creare un nuovo template
- L'AI analizza la label e propone una struttura dati
- L'utente conferma/modifica la proposta
- Viene creato un nuovo template e istanza

---

## 3. ResponseEditor

### 3.1 Panoramica

Il **ResponseEditor** è l'editor principale per configurare il comportamento di dialogo di un Task. Si apre automaticamente quando:
- Confermi un template dalla Factory
- Click sull'icona "⚙️" di un nodo nel flowchart
- Selezioni un nodo e premi `Enter`

### 3.2 Struttura dell'Editor

```
┌─────────────────────────────────────────────────────────┐
│  ResponseEditor                                         │
├──────────┬──────────────────────────────────────────────┤
│          │  [Toolbar: Test Code, Save, Close]          │
│ Sidebar  │                                              │
│ (Nodi)   │  [BehaviourEditor]                           │
│          │  - Steps (start, noMatch, noInput, ...)     │
│ • Nodo 1 │  - Escalations per ogni step                 │
│ • Nodo 2 │  - Tasks in ogni escalation                  │
│          │                                              │
│          │  [RightPanel]                                │
│          │  - RecognitionEditor (Cognition)             │
│          │  - DataExtractionEditor                     │
│          │  - MessageReview                             │
└──────────┴──────────────────────────────────────────────┘
```

### 3.3 Barra Laterale Sinistra (Sidebar)

La **Sidebar** mostra la struttura gerarchica del TaskTree:

**Struttura:**
```
📋 Chiedi Dati Personali          (Root - Introduction)
  ├─ 📝 Nome                      (Main Node)
  │   ├─ 📄 Nome (campo)          (Sub Node)
  ├─ 📝 Cognome                    (Main Node)
  │   ├─ 📄 Cognome (campo)       (Sub Node)
  └─ 📝 Email                      (Main Node)
      └─ 📄 Email (campo)         (Sub Node)
```

**Funzionalità:**
- **Click su un nodo:** Seleziona il nodo e mostra i suoi steps nel BehaviourEditor
- **Icone:**
  - 📋 = Root (introduction)
  - 📝 = Main Node (dato principale)
  - 📄 = Sub Node (sotto-dato)
- **Colori:** Ogni tipo di nodo ha un colore distintivo
- **Espansione:** Click per espandere/contrarre i sub-nodi

### 3.4 Steps

Gli **Steps** rappresentano le fasi del dialogo per ogni nodo:

**Tipi di Step:**
1. **`start`** - Messaggio iniziale quando si inizia a raccogliere il dato
2. **`noMatch`** - Messaggio quando l'input non viene riconosciuto
3. **`noInput`** - Messaggio quando l'utente non risponde
4. **`confirmation`** - Messaggio di conferma del dato raccolto
5. **`notConfirmed`** - Messaggio quando l'utente rifiuta la conferma
6. **`success`** - Messaggio quando il dato è stato raccolto con successo
7. **`introduction`** - Messaggio introduttivo (solo per root)

**Visualizzazione:**
```
┌─────────────────────────────────────┐
│  Steps:                             │
│  [start] [noMatch] [noInput]        │
│  [confirmation] [notConfirmed]      │
│  [success]                          │
└─────────────────────────────────────┘
```

**Selezione Step:**
- Click su uno step per selezionarlo
- Il BehaviourEditor mostra le escalations di quello step
- Puoi modificare i messaggi e le azioni per ogni step

### 3.5 Escalations

Le **Escalations** sono sequenze di tentativi quando uno step fallisce:

**Struttura:**
```
Step: noMatch
├─ Escalation 1 (tentativo 1)
│  └─ Task: "Non ho capito, puoi ripetere?"
├─ Escalation 2 (tentativo 2)
│  └─ Task: "Scusa, non sono riuscito a capire. Puoi dirmi in un altro modo?"
└─ Escalation 3 (tentativo 3)
   └─ Task: "Mi dispiace, non riesco a capire. Vuoi parlare con un operatore?"
```

**Come Funziona:**
1. L'utente fornisce un input che non viene riconosciuto
2. Il bot mostra il messaggio della prima escalation
3. Se ancora non capisce, mostra la seconda escalation
4. Dopo N tentativi (configurabile), passa alla terza escalation (es. transfer a operatore)

**Aggiungere un'Escalation:**
1. Seleziona uno step (es. `noMatch`)
2. Scroll fino alla fine delle escalations esistenti
3. Click sul pulsante "+ Aggiungi Escalation"
4. Appare una nuova escalation vuota
5. Aggiungi un Task (messaggio o azione) all'escalation

**Rimuovere un'Escalation:**
1. Hover sull'escalation da rimuovere
2. Click sull'icona "🗑️" (cestino)
3. Conferma la rimozione

### 3.6 Tasks nelle Escalations

Ogni escalation contiene **Tasks** (azioni) che vengono eseguite:

**Tipi di Task:**
- **SayMessage:** Mostra un messaggio all'utente
- **UtteranceInterpretation:** Chiede un dato
- **BackendCall:** Chiama un'API
- **Transfer:** Trasferisce a un operatore
- **CloseSession:** Chiude la sessione

**Aggiungere un Task:**
1. Seleziona un'escalation
2. Click su "+ Aggiungi Task" o trascina da Sidebar
3. Scegli il tipo di task
4. Configura i parametri (es. testo del messaggio)

**Modificare un Task:**
1. Click sul task nell'escalation
2. Modifica i parametri nel pannello laterale
3. Le modifiche vengono salvate automaticamente

**Eliminare un Task:**
1. Hover sul task
2. Click sull'icona "🗑️"
3. Conferma la rimozione

### 3.7 Collegamento Steps ↔ Tasks del Grafo

Gli steps nel ResponseEditor sono **collegati** ai Task del grafo flowchart:

**Relazione:**
```
Flowchart Node          →  ResponseEditor Node
─────────────────────────────────────────────────
"Chiedi Nome" (nodo)    →  "Nome" (nodo in sidebar)
  └─ Righe interne      →    └─ Sub-nodi in sidebar
```

**Modifiche Sincronizzate:**
- Modifiche nel ResponseEditor si riflettono nel flowchart
- Modifiche nel flowchart si riflettono nel ResponseEditor
- La sincronizzazione è bidirezionale e in tempo reale

**Esempio:**
1. Nel flowchart, aggiungi una riga "Cognome" al nodo "Chiedi Dati Personali"
2. Apri il ResponseEditor per quel nodo
3. Nella sidebar, vedi automaticamente il nuovo sub-nodo "Cognome"
4. Puoi configurare steps ed escalations per "Cognome"

### 3.8 Come il ResponseEditor Modifica la Logica del Bot

Le modifiche nel ResponseEditor influenzano direttamente il comportamento del bot:

**1. Messaggi:**
- Modifiche ai messaggi degli steps cambiano cosa dice il bot
- Esempio: Cambi "start" da "Inserisci il nome" a "Per favore, dimmi il tuo nome"

**2. Escalations:**
- Aggiungere/rimuovere escalations cambia quanti tentativi fa il bot
- Esempio: Aggiungi una 4a escalation → il bot fa 4 tentativi invece di 3

**3. Tasks nelle Escalations:**
- Aggiungere un Task "Transfer" in escalation 3 → il bot trasferisce a operatore dopo 3 tentativi
- Aggiungere un Task "BackendCall" → il bot chiama un'API durante l'escalation

**4. Ordine degli Steps:**
- L'ordine degli steps determina il flusso di dialogo
- Esempio: Se modifichi l'ordine, il bot segue il nuovo ordine

**Salvataggio:**
- Le modifiche vengono salvate automaticamente quando chiudi l'editor
- Oppure click su "Salva" nella toolbar per salvare manualmente

---

## 4. Persona & Escalation Overview

### 4.1 Sezione Persona

La **Persona** definisce il tono e lo stile di comunicazione del bot:

**Configurazione:**
```
┌─────────────────────────────────────┐
│  Persona                            │
├─────────────────────────────────────┤
│  Nome Bot: Assistente Virtuale     │
│  Tono: Professionale e Amichevole  │
│  Lingua: Italiano                   │
│  Stile: Formale ma Accessibile     │
└─────────────────────────────────────┘
```

**Impatto:**
- La Persona influenza come vengono generati i messaggi
- L'AI adatta i testi degli steps in base alla Persona
- Esempio: Persona "Giovane e Informale" → "Ciao! Dimmi il nome" vs Persona "Professionale" → "Buongiorno, potrebbe fornirmi il nome?"

### 4.2 Escalation Overview

L'**Escalation Overview** mostra una panoramica di tutte le escalations configurate:

**Visualizzazione:**
```
┌─────────────────────────────────────────────────┐
│  Escalation Overview                            │
├─────────────────────────────────────────────────┤
│  Nodo: Nome                                     │
│  Step: noMatch                                   │
│  Escalations: 3                                  │
│  ├─ Esc 1: "Non ho capito"                      │
│  ├─ Esc 2: "Puoi ripetere?"                     │
│  └─ Esc 3: "Transfer a operatore"                │
│                                                 │
│  Nodo: Email                                     │
│  Step: noMatch                                   │
│  Escalations: 2                                  │
│  ├─ Esc 1: "Inserisci un'email valida"          │
│  └─ Esc 2: "Esempio: nome@email.com"            │
└─────────────────────────────────────────────────┘
```

**Funzionalità:**
- **Panoramica Completa:** Vedi tutte le escalations di tutti i nodi in un'unica vista
- **Filtri:** Filtra per nodo, step, tipo di escalation
- **Modifica Rapida:** Click su un'escalation per modificarla direttamente
- **Statistiche:** Vedi quante escalations hai configurato per ogni step

### 4.3 Influenza sul Comportamento del Bot

Le escalations determinano come il bot gestisce gli errori e le situazioni di fallimento:

**Scenario 1: Input Non Riconosciuto**
```
Utente: "asdfghjkl"  (input non valido)
Bot: [Escalation 1] "Non ho capito, puoi ripetere?"
Utente: "asdfghjkl"  (ancora non valido)
Bot: [Escalation 2] "Scusa, non sono riuscito a capire. Puoi dirmi in un altro modo?"
Utente: "asdfghjkl"  (ancora non valido)
Bot: [Escalation 3] "Mi dispiace, non riesco a capire. Vuoi parlare con un operatore?"
```

**Scenario 2: Nessuna Risposta**
```
Bot: "Inserisci il nome"
Utente: [nessuna risposta - timeout]
Bot: [Escalation 1 noInput] "Non ho ricevuto una risposta. Puoi inserire il nome?"
Utente: [ancora nessuna risposta]
Bot: [Escalation 2 noInput] "Sei ancora lì? Ho bisogno del nome per procedere."
Utente: [ancora nessuna risposta]
Bot: [Escalation 3 noInput] "Sembra che tu non sia più connesso. Chiudo la sessione."
```

**Configurazione Avanzata:**
- **Timeout:** Configura quanto tempo aspettare prima di considerare "noInput"
- **Max Tentativi:** Configura quante escalations eseguire prima di fallire
- **Azioni Finali:** Configura cosa fare dopo l'ultima escalation (transfer, close, retry)

---

## 5. Cognition

### 5.1 Panoramica

**Cognition** è il sistema di riconoscimento semantico che permette al bot di capire l'input dell'utente. Usa **Contracts** (contratti semantici) per definire come interpretare i dati.

### 5.2 Contracts Semantici

Un **Contract** definisce:
- **Cosa** riconoscere (es. email, telefono, data)
- **Come** riconoscerlo (regex, NER, LLM)
- **Validazione** (formato, range, pattern)

**Struttura di un Contract:**
```typescript
{
  templateName: "email",           // Nome del template
  templateId: "template-guid",     // ID del template
  kind: "email",                   // Tipo di dato
  regex: {
    patterns: ["[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}"],
    flags: "i"
  },
  ner: {
    entityTypes: ["EMAIL"],
    confidence: 0.8
  },
  llm: {
    systemPrompt: "Extract email addresses from user input",
    model: "gpt-4"
  },
  validation: {
    format: "email",
    required: true
  }
}
```

### 5.3 Riconoscitori

Il sistema supporta **4 metodi di riconoscimento**:

#### 5.3.1 Regex (Espressioni Regolari)

**Uso:** Pattern deterministici e veloci

**Esempio:**
```regex
Email: [a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}
Telefono: \+?[0-9]{10,15}
Data: \d{1,2}[/-]\d{1,2}[/-]\d{2,4}
```

**Configurazione:**
1. Apri RecognitionEditor
2. Seleziona il nodo
3. Vai alla tab "Regex"
4. Inserisci il pattern regex
5. Testa con esempi nella griglia

**Vantaggi:**
- Veloce
- Deterministico
- Nessun costo API

**Svantaggi:**
- Limitato a pattern semplici
- Non gestisce varianti linguistiche

#### 5.3.2 NER (Named Entity Recognition)

**Uso:** Riconoscimento di entità pre-addestrate

**Esempio:**
```
Input: "Il mio numero è 333-1234567"
NER riconosce: { type: "PHONE", value: "333-1234567", confidence: 0.95 }
```

**Configurazione:**
1. Apri RecognitionEditor
2. Seleziona "NER" come metodo
3. Scegli i tipi di entità da riconoscere:
   - PERSON (nomi di persona)
   - EMAIL (indirizzi email)
   - PHONE (numeri di telefono)
   - DATE (date)
   - LOCATION (luoghi)
   - ORGANIZATION (organizzazioni)
4. Configura la confidence minima (es. 0.8)

**Vantaggi:**
- Riconosce varianti linguistiche
- Pre-addestrato su grandi dataset
- Buona accuracy

**Svantaggi:**
- Richiede modello NER esterno
- Può essere lento
- Costo API

#### 5.3.3 LLM (Large Language Model)

**Uso:** Riconoscimento semantico avanzato usando AI

**Esempio:**
```
Input: "Sono nato il 15 marzo 1990"
LLM estrae: { day: 15, month: 3, year: 1990 }
```

**Configurazione:**
1. Apri RecognitionEditor
2. Seleziona "LLM" come metodo
3. Configura il System Prompt:
   ```
   Extract the birth date from user input.
   Return JSON: { day: number, month: number, year: number }
   ```
4. Scegli il modello (GPT-4, Claude, ecc.)
5. Configura temperatura e altri parametri

**Vantaggi:**
- Molto flessibile
- Capisce contesto e varianti
- Può estrarre dati complessi

**Svantaggi:**
- Costoso (costo API)
- Lento
- Non deterministico

#### 5.3.4 Deterministic (Extractor Code)

**Uso:** Codice JavaScript personalizzato per estrazione

**Esempio:**
```javascript
function extract(input) {
  // Logica personalizzata
  const match = input.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (match) {
    return {
      day: parseInt(match[1]),
      month: parseInt(match[2]),
      year: parseInt(match[3])
    };
  }
  return null;
}
```

**Configurazione:**
1. Apri RecognitionEditor
2. Seleziona "Extractor" come metodo
3. Scrivi il codice JavaScript nell'editor
4. Testa con esempi

**Vantaggi:**
- Controllo totale
- Veloce
- Nessun costo API

**Svantaggi:**
- Richiede programmazione
- Manutenzione complessa

### 5.4 Editor dei Contracts

L'**Editor dei Contracts** permette di modificare i contratti semantici:

**Interfaccia:**
```
┌─────────────────────────────────────┐
│  Contract Editor: Email             │
├─────────────────────────────────────┤
│  Kind: email                        │
│  Min Confidence: 0.8                │
│                                     │
│  Methods:                           │
│  ☑ Regex                            │
│  ☑ NER                              │
│  ☑ LLM                              │
│  ☐ Extractor                        │
│                                     │
│  [Edit Regex] [Edit NER] [Edit LLM]│
└─────────────────────────────────────┘
```

**Modifica di un Metodo:**
1. Click su "Edit [Metodo]"
2. Si apre l'editor specifico:
   - **Regex Editor:** Inserisci pattern, testa con esempi
   - **NER Editor:** Seleziona entity types, configura confidence
   - **LLM Editor:** Scrivi system prompt, scegli modello
   - **Extractor Editor:** Scrivi codice JavaScript
3. Salva le modifiche

**Salvataggio:**
- Le modifiche vengono salvate nel contract del nodo
- Il contract viene sincronizzato con il template (se presente)
- Puoi scegliere di aggiornare solo l'istanza o anche il template

### 5.5 Uso delle Espressioni Regolari

**Sintassi Base:**
```regex
.        → Qualsiasi carattere
\d       → Cifra (0-9)
\w       → Carattere alfanumerico
+        → Uno o più
*        → Zero o più
?        → Zero o uno
{n,m}    → Da n a m occorrenze
^        → Inizio stringa
$        → Fine stringa
[abc]    → Uno tra a, b, c
(abc)    → Gruppo di cattura
```

**Esempi Pratici:**
```regex
Email: [a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}
Telefono IT: \+?39\s?3\d{2}\s?\d{6,7}
Codice Fiscale: [A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]
Data IT: \d{1,2}[/-]\d{1,2}[/-]\d{2,4}
CAP: \d{5}
```

**Testing:**
- Usa la griglia di test per provare i pattern
- Inserisci esempi di input
- Verifica che il pattern matchi correttamente
- Aggiusta il pattern finché non funziona

### 5.6 Uso dei Contracts nel Runtime

Durante l'esecuzione, il runtime usa i contracts per interpretare l'input:

**Processo:**
1. **Input Utente:** "Il mio email è mario.rossi@example.com"
2. **Caricamento Contract:** Il runtime carica il contract per il nodo corrente
3. **Tentativo Estrazione:**
   - Prova prima **Regex** (veloce, deterministico)
   - Se fallisce, prova **NER** (riconoscimento entità)
   - Se fallisce, prova **LLM** (estrazione semantica)
   - Se fallisce, prova **Extractor** (codice personalizzato)
4. **Risultato:**
   ```typescript
   {
     hasMatch: true,
     values: { email: "mario.rossi@example.com" },
     source: "regex",  // Metodo che ha funzionato
     confidence: 1.0
   }
   ```
5. **Validazione:** Verifica che il valore estratto rispetti i vincoli del contract
6. **Salvataggio:** Salva il valore nella memoria del bot

**Fallback:**
- Se tutti i metodi falliscono → `noMatch`
- Il bot mostra l'escalation `noMatch` configurata
- Dopo N tentativi, passa all'escalation successiva

---

## 6. Embeddings

### 6.1 Panoramica

Gli **Embeddings** sono rappresentazioni vettoriali dei testi che permettono al bot di capire la semantica e trovare corrispondenze simili.

### 6.2 Come Funzionano

**Processo:**
1. **Generazione:**
   - Il testo viene processato da un modello di embeddings (es. OpenAI, Cohere)
   - Il modello genera un vettore numerico (es. 1536 dimensioni)
   - Il vettore cattura il significato semantico del testo

2. **Storage:**
   - Gli embeddings vengono salvati nel database
   - Associati al template o al nodo
   - Usati per ricerca semantica

3. **Ricerca:**
   - Quando l'utente digita qualcosa, viene generato l'embedding dell'input
   - Viene confrontato con gli embeddings salvati (similarità coseno)
   - I match più simili vengono restituiti

**Esempio:**
```
Input: "Chiedi il nome"
Embedding: [0.123, -0.456, 0.789, ...]  (vettore 1536-dim)

Template: "Nome"
Embedding: [0.125, -0.458, 0.791, ...]  (vettore simile)

Similarità: 0.98  → Match trovato!
```

### 6.3 Generazione degli Embeddings

**Automatica:**
- Quando crei un nuovo template, gli embeddings vengono generati automaticamente
- Usa il labelKey e le traduzioni del template
- Genera embeddings per ogni lingua supportata

**Manuale:**
1. Apri RecognitionEditor
2. Vai alla tab "Embeddings"
3. Click su "Genera Embeddings"
4. Scegli il modello (OpenAI, Cohere, ecc.)
5. Attendi la generazione

**Configurazione:**
- **Modello:** Scegli il modello di embeddings (text-embedding-ada-002, ecc.)
- **Dimensione:** Configura la dimensione del vettore (default: 1536)
- **Normalizzazione:** Abilita normalizzazione per migliorare la ricerca

### 6.4 Utilizzo degli Embeddings

Gli embeddings vengono usati per:

**1. Ricerca Semantica:**
- Quando l'utente cerca un template, gli embeddings trovano match semantici
- Esempio: Cerca "nome" → trova anche "nominativo", "cognome", ecc.

**2. Intellisense:**
- L'Intellisense usa embeddings per suggerire azioni rilevanti
- Esempio: Digiti "chiedi" → suggerisce template di raccolta dati

**3. Classificazione:**
- Gli embeddings aiutano a classificare l'intento dell'utente
- Esempio: "Voglio prenotare" → classifica come intent "booking"

**4. Match Fuzzy:**
- Gli embeddings permettono match anche con testi leggermente diversi
- Esempio: "data nascita" matcha con "data di nascita"

### 6.5 Influenza sulla Comprensione del Bot

Gli embeddings migliorano significativamente la comprensione del bot:

**Prima (senza embeddings):**
```
Utente: "Dimmi il nome"
Bot: ❌ Non capisco (match esatto fallito)
```

**Dopo (con embeddings):**
```
Utente: "Dimmi il nome"
Bot: ✅ Capisce (match semantico trovato)
  → Estrae: { nome: "..." }
```

**Vantaggi:**
- **Robustezza:** Il bot capisce varianti linguistiche
- **Flessibilità:** Non richiede match esatti
- **Multilingua:** Funziona con traduzioni
- **Scalabilità:** Migliora con più dati

---

## 7. Testing

### 7.1 Panoramica

La **modalità Test** permette di testare il TaskTree in tempo reale senza dover deployare il bot.

### 7.2 Attivazione della Modalità Test

**Metodo 1: Toolbar ResponseEditor**
1. Apri ResponseEditor per un Task
2. Click su "Test Code" nella toolbar
3. Si apre il pannello di test in basso

**Metodo 2: Flowchart**
1. Seleziona un nodo nel flowchart
2. Click su "▶️ Play" nella toolbar del nodo
3. Si apre il simulatore di chat

### 7.3 Esecuzione del TaskTree

**Processo:**
1. **Inizializzazione:**
   - Il sistema carica il TaskTree completo
   - Inizializza la memoria del bot (vuota)
   - Prepara il runtime

2. **Start:**
   - Il bot mostra il messaggio `introduction` (se presente)
   - Oppure il messaggio `start` del primo nodo
   - Attende input utente

3. **Loop di Esecuzione:**
   ```
   Bot mostra messaggio
   ↓
   Utente fornisce input
   ↓
   Runtime processa input (usando Contracts)
   ↓
   Se match → salva dato, mostra confirmation
   Se noMatch → mostra escalation noMatch
   Se noInput → mostra escalation noInput
   ↓
   Se tutti i dati raccolti → success
   Altrimenti → prossimo nodo
   ```

4. **Completamento:**
   - Quando tutti i dati sono raccolti, mostra messaggio `success`
   - Termina la sessione

### 7.4 Visualizzazione Log, Stati, Transizioni

**Pannello di Test:**
```
┌─────────────────────────────────────────────────┐
│  Chat Simulator                                 │
├─────────────────────────────────────────────────┤
│  Bot: "Buongiorno! Inserisci il nome"          │
│  Utente: "Mario"                                │
│  Bot: "Hai detto Mario, è corretto?"            │
│  Utente: "Sì"                                   │
│  Bot: "Perfetto! Ora inserisci l'email"        │
│                                                 │
│  [Log]                                          │
│  ├─ State: CollectingMain (nome)               │
│  ├─ Step: confirmation                         │
│  ├─ Match: { nome: "Mario" }                  │
│  ├─ Transition: nome → email                   │
│  └─ Memory: { nome: "Mario", confirmed: true } │
└─────────────────────────────────────────────────┘
```

**Informazioni Mostrate:**
- **Messaggi:** Tutti i messaggi scambiati tra bot e utente
- **Stati:** Stato corrente del bot (CollectingMain, CollectingSub, Confirming, ecc.)
- **Steps:** Step corrente (start, noMatch, confirmation, ecc.)
- **Transizioni:** Quando il bot passa da un nodo all'altro
- **Memory:** Dati raccolti finora
- **Contracts:** Quale contract ha matchato l'input
- **Escalations:** Quale escalation è stata eseguita

**Log Dettagliati:**
- Click su "Mostra Log Dettagliati" per vedere:
  - Timestamp di ogni evento
  - Valori intermedi
  - Errori e warning
  - Performance (tempo di esecuzione)

### 7.5 Risposte del Bot

**Visualizzazione:**
- Le risposte del bot appaiono come bolle blu nella chat
- I messaggi dell'utente appaiono come bolle grigie
- Ogni messaggio mostra:
  - Timestamp
  - Tipo (bot/utente)
  - Contenuto
  - Metadati (step, escalation, ecc.)

**Modifica in Tempo Reale:**
- Puoi modificare i messaggi direttamente nella chat
- Le modifiche si riflettono immediatamente
- Utile per testare varianti di messaggi

**Debug:**
- Click su un messaggio per vedere i dettagli:
  - Quale step ha generato il messaggio
  - Quale escalation è stata usata
  - Quali dati erano disponibili
  - Perché è stato scelto quel messaggio

### 7.6 Test Avanzati

**Test con Dati Predefiniti:**
1. Configura dati di test nella griglia RecognitionEditor
2. Avvia il test
3. Il bot usa automaticamente i dati predefiniti invece di chiedere all'utente

**Test di Scenari:**
1. Crea scenari di test (es. "Utente fornisce dati validi", "Utente fornisce dati invalidi")
2. Esegui ogni scenario
3. Verifica che il bot si comporti correttamente

**Test di Performance:**
- Misura il tempo di risposta
- Verifica che non ci siano lag
- Ottimizza i contracts se necessario

**Test di Robustezza:**
- Prova input edge case (vuoti, molto lunghi, caratteri speciali)
- Verifica che il bot gestisca correttamente gli errori
- Testa tutte le escalations

---

## Conclusione

Questo editor visuale ti permette di costruire bot conversazionali complessi senza scrivere codice. Il flusso completo è:

1. **Disegni il grafo** nel Flowchart
2. **L'euristica propone template** dalla Factory
3. **Configuri il dialogo** nel ResponseEditor
4. **Definisci la cognition** con Contracts
5. **Generi embeddings** per ricerca semantica
6. **Testi tutto** nella modalità Test

Ogni parte del sistema è integrata e sincronizzata, permettendoti di costruire bot sofisticati in modo visuale e intuitivo.
