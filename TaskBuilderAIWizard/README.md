# Task Builder AI Wizard - Documentazione Completa

## NOVITÀ v1.3.0 - Correzioni UI

### Miglioramenti Implementati
- ✅ **Icone più grandi**: Da 20px a 24px nelle card delle fasi (più visibili)
- ✅ **Payoff espressivi**: "Schema gerarchico e campi", "Comprensione linguaggio naturale", etc.
- ✅ **Pulsanti Sì/No affidabili**: Rimossa complessità che causava problemi di rendering
- ✅ **Build verificato**: Compilazione senza errori

---

## Panoramica

Il **Task Builder AI Wizard** è un prototipo React autonomo che simula la generazione automatica di moduli task attraverso AI. Questo modulo è stato progettato per essere facilmente integrato in Cursor, dove i dati fake possono essere sostituiti 1:1 con dati reali senza riscrivere la logica.

## Caratteristiche Principali

- **Layout a 3 Pannelli**: Sidebar (280-320px) + Pannello Centrale (dinamico) + Pannello Destro (300-360px)
- **Pipeline Animata**: 4 step di generazione con sotto-step sequenziali
- **Dialoghi Simulati**: 4 scenari (Happy Path, Frasi Parziali, Error Handling, Validazione)
- **Endpoint Fake**: Simulazione completa delle chiamate API
- **Stato Locale**: Gestione dello stato wizard autonoma
- **Componenti Modulari**: Struttura riutilizzabile e manutenibile
- **Sincronizzazione Sidebar**: Highlight automatico e scroll ai nodi attivi

---

## Struttura Cartelle

```
TaskBuilderAIWizard/
├── WizardApp.tsx                 # Entry point principale
├── components/
│   ├── Sidebar.tsx               # Albero task con expand/collapse
│   ├── CenterPanel.tsx           # Input utente + pipeline
│   ├── RightPanel.tsx            # Anteprima dialoghi con tab
│   ├── Pipeline.tsx              # Visualizzazione step generazione
│   └── Toast.tsx                 # Notifiche UI
├── hooks/
│   ├── useWizardState.ts         # Stato globale wizard
│   ├── useSimulation.ts          # Logica simulazione pipeline
│   └── useSidebarSync.ts         # Sincronizzazione sidebar
├── fakeApi/
│   └── simulateEndpoints.ts      # Endpoint fake (4 funzioni)
├── types/
│   ├── FakeDataNode.ts           # Tipo nodo dati
│   ├── FakeConstraint.ts         # Tipo vincolo
│   ├── FakeNLPContract.ts        # Tipo contratto NLP
│   ├── FakeStepMessages.ts       # Tipo messaggi step
│   ├── FakeModuleTemplate.ts     # Tipo template modulo
│   ├── FakeTaskTreeNode.ts       # Tipo nodo albero task
│   ├── WizardStep.ts             # Enum step wizard
│   └── index.ts                  # Export centralizzato
├── utils/
│   ├── mockData.ts               # Dati mock per simulazione
│   └── delays.ts                 # Utility per timing simulazione
└── README.md                     # Questo file
```

---

## Tipi Fake (Compatibili con i Reali)

### 1. FakeDataNode
Rappresenta un nodo nella struttura dati del task.

```typescript
export type FakeDataNode = {
  id: string;
  label: string;
  type: "string" | "number" | "date" | "boolean" | "object";
  children?: FakeDataNode[];
};
```

**Esempio:**
```typescript
{
  id: 'booking',
  label: 'Prenotazione Ristorante',
  type: 'object',
  children: [
    { id: 'date', label: 'Data', type: 'date' },
    { id: 'guests', label: 'Numero Ospiti', type: 'number' }
  ]
}
```

---

### 2. FakeConstraint
Rappresenta un vincolo di validazione.

```typescript
export type FakeConstraint = {
  kind: string;
  title: string;
  payoff: string;
  min?: number | string;
  max?: number | string;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  values?: Array<string | number>;
  format?: string;
};
```

**Esempio:**
```typescript
{
  kind: 'range',
  title: 'Numero Valido',
  payoff: 'Il numero di ospiti deve essere tra 1 e 20',
  min: 1,
  max: 20
}
```

---

### 3. FakeNLPContract
Rappresenta il contratto NLP per il parsing.

```typescript
export type FakeNLPContract = {
  templateName: string;
  templateId: string;
  subDataMapping: Record<string, {
    canonicalKey: string;
    label: string;
    type: string;
  }>;
  regex: { patterns: string[]; testCases: string[] };
  rules: { extractorCode: string; validators: any[]; testCases: string[] };
  ner?: { entityTypes: string[]; confidence: number; enabled: boolean };
  llm: { systemPrompt: string; userPromptTemplate: string; responseSchema: object; enabled: boolean };
};
```

---

### 4. FakeStepMessages
Rappresenta i messaggi del dialogo.

```typescript
export type FakeStepMessages = {
  ask: { base: string[]; reask?: string[] };
  confirm?: { base: string[]; reask?: string[] };
  notConfirmed?: { base: string[] };
  violation?: { base: string[]; reask?: string[] };
  disambiguation?: { base: string[]; options: string[] };
  success?: { base: string[]; reward?: string[] };
};
```

---

### 5. FakeModuleTemplate
Rappresenta un template di modulo preconfigurato.

```typescript
export type FakeModuleTemplate = {
  id: string;
  name: string;
  label: string;
  type: string;
  icon: string;
  subTasks?: Array<{ templateId: string; label: string; type: string }>;
  constraints?: FakeConstraint[];
  dataContract?: FakeNLPContract;
  examples?: string[];
};
```

---

### 6. FakeTaskTreeNode
Rappresenta un nodo nell'albero dei task visualizzato nella sidebar.
Ogni nodo traccia il proprio stato di esecuzione della pipeline.

```typescript
export type TaskPipelineStatus = {
  constraints: 'pending' | 'running' | 'completed';
  parser: 'pending' | 'running' | 'completed';
  messages: 'pending' | 'running' | 'completed';
};

export type FakeTaskTreeNode = {
  id: string;
  templateId: string;
  label: string;
  type?: string;
  icon?: string;

  // Dati generati dalla pipeline
  constraints?: FakeConstraint[];
  dataContract?: FakeNLPContract;

  // Stato di esecuzione per questo task
  pipelineStatus?: TaskPipelineStatus;

  // Subtask gerarchici
  subNodes?: FakeTaskTreeNode[];
};
```

**Esempio con stato:**
```typescript
{
  id: 'birthdate',
  templateId: 'birthdate',
  label: 'Data di Nascita',
  type: 'object',
  pipelineStatus: {
    constraints: 'completed',
    parser: 'running',
    messages: 'pending'
  },
  subNodes: [
    {
      id: 'day',
      templateId: 'day',
      label: 'Giorno',
      type: 'number',
      pipelineStatus: {
        constraints: 'completed',
        parser: 'completed',
        messages: 'pending'
      }
    }
  ]
}
```

---

## Endpoint Fake

### 1. fakeGenerateStructure
Simula la generazione della struttura dati del task.

```typescript
async function fakeGenerateStructure(
  description: string,
  speed: SimulationSpeed = 'fast'
): Promise<FakeDataNode[]>
```

**Input:** Descrizione testuale del task
**Output:** Array di nodi dati gerarchici
**Delay:** 800ms * speed multiplier

---

### 2. fakeGenerateConstraints
Simula la generazione dei vincoli di validazione.

```typescript
async function fakeGenerateConstraints(
  schema: FakeDataNode[],
  speed: SimulationSpeed = 'fast'
): Promise<FakeConstraint[]>
```

**Input:** Schema dati generato
**Output:** Array di vincoli
**Delay:** 800ms * speed multiplier

---

### 3. fakeGenerateParsers
Simula la generazione del contratto NLP.

```typescript
async function fakeGenerateParsers(
  schema: FakeDataNode[],
  speed: SimulationSpeed = 'fast'
): Promise<FakeNLPContract>
```

**Input:** Schema dati generato
**Output:** Contratto NLP completo
**Delay:** 800ms * speed multiplier

---

### 4. fakeGenerateMessages
Simula la generazione dei messaggi del dialogo.

```typescript
async function fakeGenerateMessages(
  schema: FakeDataNode[],
  speed: SimulationSpeed = 'fast'
): Promise<FakeStepMessages>
```

**Input:** Schema dati generato
**Output:** Messaggi per tutti gli scenari
**Delay:** 800ms * speed multiplier

---

## Stati del Wizard

Il wizard supporta 9 stati diversi:

```typescript
export type WizardStep =
  | "euristica_trovata"        // Euristica rilevata
  | "euristica_non_trovata"    // Nessuna euristica trovata
  | "lista_moduli"             // Mostra lista moduli disponibili
  | "generazione_struttura"    // Generazione schema dati
  | "generazione_constraints"  // Generazione vincoli
  | "generazione_contracts"    // Generazione parser NLP
  | "generazione_messaggi"     // Generazione messaggi
  | "modulo_pronto"            // Modulo completato
  | "correzione";              // Modalità correzione
```

---

## Architettura di Parallelizzazione Massiva

### Concetto Chiave: Pipeline per Ogni Task

Il wizard implementa una **parallelizzazione massiva** dove ogni task (root + subtask) esegue la propria pipeline **contemporaneamente** alle altre.

#### Esempio: Data di Nascita
```
📅 Data di Nascita (root)
  ├─ 📆 Giorno (subtask)
  ├─ 📆 Mese (subtask)
  └─ 📆 Anno (subtask)
```

### Fasi di Esecuzione

#### Fase 1: Struttura Dati (PREGIUDIZIALE)
Unica fase sequenziale che deve completare prima di tutto.
- Genera l'albero gerarchico dei task
- Inizializza `pipelineStatus` per ogni nodo
- Attende conferma utente

#### Fase 2: Parallelizzazione Massiva
Dopo la conferma, **tutte** le operazioni partono in parallelo:

```
Per ogni task nell'albero:
  - Genera vincoli ⚡
  - Genera parser ⚡
  - Genera messaggi ⚡
```

**Con 4 task (1 root + 3 subtask):**
- 4 task × 3 fasi = **12 operazioni parallele**
- Tempo di attesa = tempo dell'operazione più lenta
- **Accelerazione teorica: 12x**

### Stato Aggregato della Pipeline

Lo **step della pipeline centrale** diventa verde SOLO quando **TUTTI i task** di quella categoria sono completati:

- **Vincoli** ✅ → Quando tutti i 4 task hanno completato i vincoli
- **Parser** ✅ → Quando tutti i 4 task hanno completato i parser
- **Messaggi** ✅ → Quando tutti i 4 task hanno completato i messaggi

### Visualizzazione dello Stato

#### Sidebar (Sinistra)
Ogni task mostra un **indicatore colorato**:
- 🔴 Grigio: in attesa
- 🔵 Blu pulsante: in esecuzione
- 🟢 Verde: completato

#### Pipeline (Centro)
Mostra lo **stato aggregato** per categoria:
- Grigio: almeno un task è in attesa
- Blu: almeno un task è in esecuzione
- Verde: TUTTI i task sono completati

### Implementazione Tecnica

#### 1. Tipo TaskPipelineStatus
Ogni task traccia il proprio stato per ogni fase:
```typescript
type TaskPipelineStatus = {
  constraints: 'pending' | 'running' | 'completed';
  parser: 'pending' | 'running' | 'completed';
  messages: 'pending' | 'running' | 'completed';
};
```

#### 2. Funzione updateTaskPipelineStatus
Aggiorna lo stato di un singolo task e ricalcola lo stato aggregato:
```typescript
updateTaskPipelineStatus(taskId, 'constraints', 'running')
```

#### 3. Promise.all per Parallelizzazione
Tutte le operazioni vengono lanciate insieme:
```typescript
const allPromises = [];
allTasks.forEach(task => {
  allPromises.push(generateConstraintsForTask(task));
  allPromises.push(generateParsersForTask(task));
  allPromises.push(generateMessagesForTask(task));
});
await Promise.all(allPromises);
```

### Vantaggi dell'Architettura

1. **Performance**: tempo di attesa drasticamente ridotto
2. **Scalabilità**: funziona con qualsiasi numero di task
3. **Visualizzazione chiara**: stato individuale + aggregato
4. **Codice pulito**: ogni task è indipendente

---

## Flusso Dati

### 1. Input Utente
L'utente inserisce una descrizione testuale del task nel `CenterPanel`.

### 2. Avvio Pipeline - Fase 1 (Sequenziale)
Il pulsante "Genera Modulo" avvia la generazione della struttura dati.
- Crea l'albero gerarchico dei task
- Inizializza `pipelineStatus` per ogni nodo

### 3. Conferma Struttura
L'utente conferma la struttura proposta.

### 4. Esecuzione Parallela - Fase 2
Per ogni task (root + subtask), in parallelo:
- Genera vincoli di validazione
- Genera parser NLP (Regex, NER, LLM)
- Genera messaggi per tutti gli scenari

### 5. Aggiornamento UI in Tempo Reale
Ogni task aggiorna:
- Il proprio indicatore nella sidebar
- Lo stato aggregato nella pipeline centrale

### 6. Completamento
Quando tutti i task hanno completato tutte le fasi:
- Il pannello destro diventa visibile
- Vengono mostrati i 4 scenari di dialogo
- La sidebar mostra la struttura completa con tutti gli indicatori verdi

---

## Layout a 3 Pannelli

### Sidebar (Sinistra)
- **Larghezza:** 320px fissi
- **Contenuto:** Albero task gerarchico
- **Interazioni:**
  - Click su nodo → highlight
  - Expand/collapse nodi con children
  - Auto-scroll al nodo attivo

### CenterPanel (Centro)
- **Larghezza:** Dinamica (flex-1)
- **Contenuto:**
  - Input textarea per descrizione
  - Pulsante "Genera Modulo"
  - Pipeline animata (durante generazione)
  - Messaggio successo (al completamento)

### RightPanel (Destra)
- **Larghezza:** 384px fissi
- **Contenuto:**
  - Tab scenari dialogo
  - Anteprima conversazioni simulate
- **Visibilità:** Solo quando `currentStep === 'modulo_pronto'`

---

## Pipeline Animata

La pipeline mostra 4 step principali, ognuno con sotto-step:

### Step 1: Generazione Struttura
- Substep 1.1: Analisi Input
- Substep 1.2: Creazione Schema

### Step 2: Generazione Vincoli
- Substep 2.1: Definizione Regole

### Step 3: Generazione Parser
- Substep 3.1: Pattern Regex
- Substep 3.2: NER Config
- Substep 3.3: LLM Setup

### Step 4: Generazione Messaggi
- Substep 4.1: Template Messaggi

**Animazioni:**
- Stato `pending`: Cerchio grigio
- Stato `running`: Spinner blu rotante
- Stato `completed`: Check verde
- Stato `error`: X rossa

---

## Dialoghi Simulati

Il pannello destro mostra 4 scenari:

### 1. Happy Path
Conversazione ideale senza errori.

### 2. Frasi Parziali
L'utente fornisce informazioni incomplete, il bot chiede chiarimenti.

### 3. Error Handling
L'utente fornisce input incomprensibile, il bot gestisce l'errore.

### 4. Validazione
L'utente fornisce dati che violano i vincoli, il bot richiede correzione.

---

## Controllo Velocità Simulazione

Il wizard supporta 3 velocità:
- **Veloce (1x):** Moltiplicatore 1, durata base 800ms
- **Media (2x):** Moltiplicatore 2, durata 1600ms
- **Lenta (3x):** Moltiplicatore 3, durata 2400ms

Questo permette di osservare la pipeline in dettaglio o accelerare per demo veloci.

---

## Come Sostituire i Fake con i Reali (Guida per Cursor)

### Step 1: Sostituisci i Tipi
Sostituisci gli import in tutti i file:

```typescript
// PRIMA (fake)
import { FakeDataNode, FakeConstraint } from '../types';

// DOPO (reali)
import { DataNode, Constraint } from '@real-package/types';
```

### Step 2: Sostituisci gli Endpoint
Sostituisci le funzioni fake in `simulateEndpoints.ts`:

```typescript
// PRIMA (fake)
import { fakeGenerateStructure } from '../fakeApi/simulateEndpoints';

// DOPO (reali)
import { generateStructure } from '@real-package/api';
```

### Step 3: Rimuovi i Delay
Rimuovi i parametri `speed` e le chiamate `delay()` dagli endpoint reali.

### Step 4: Aggiorna i Mock Data
Sostituisci `mockData.ts` con chiamate API reali o rimuovilo completamente.

### Step 5: Testa l'Integrazione
- Verifica che tutti i tipi siano compatibili
- Testa ogni endpoint con dati reali
- Verifica che la UI si aggiorni correttamente

---

## Convenzioni di Naming

- **Componenti:** PascalCase (es: `Sidebar.tsx`, `CenterPanel.tsx`)
- **Hooks:** camelCase con prefisso `use` (es: `useWizardState.ts`)
- **Tipi fake:** PascalCase con prefisso `Fake` (es: `FakeDataNode`)
- **Servizi fake:** camelCase (es: `simulateEndpoints.ts`)
- **Variabili:** camelCase (es: `userInput`, `activeNodeId`)
- **Costanti:** UPPER_SNAKE_CASE (es: `TIMINGS.STEP_BASE`)

---

## Testing Manuale

### Test 1: Generazione Base
1. Inserisci: "Voglio prenotare un tavolo al ristorante"
2. Clicca "Genera Modulo"
3. Verifica che la pipeline si completi
4. Verifica che la sidebar mostri la struttura
5. Verifica che il pannello destro mostri i dialoghi

### Test 2: Velocità Simulazione
1. Cambia velocità da Veloce a Lenta
2. Genera un nuovo modulo
3. Verifica che la pipeline sia più lenta

### Test 3: Sincronizzazione Sidebar
1. Completa una generazione
2. Clicca su un nodo nella sidebar
3. Verifica che il nodo venga evidenziato

### Test 4: Scenari Dialogo
1. Completa una generazione
2. Clicca su ogni tab del pannello destro
3. Verifica che i dialoghi cambino

---

## Estensioni Future

Questo prototipo può essere esteso con:
- Editing inline dei nodi task
- Drag & drop per riorganizzare la struttura
- Export JSON della configurazione
- Import moduli esistenti
- Validazione real-time durante la generazione
- History/undo per tornare a step precedenti

---

## Contatti & Supporto

Per domande o problemi, consulta la documentazione del progetto principale o contatta il team di sviluppo.

---

---

## NOVITÀ - Preview Dialoghi durante Selezione Manuale (v1.2.0)

### Problema Risolto
Nella versione precedente, quando l'utente apriva l'accordion "Cerca in libreria" e selezionava una card, il pannello destro rimaneva vuoto. Gli esempi di dialogo venivano mostrati SOLO dopo aver completato l'intero wizard.

### Soluzione Implementata
Ora quando selezioni una card nell'accordion, il pannello destro mostra **immediatamente** esempi di conversazione per quel task specifico, con tutti e 3 gli scenari (Happy Path, Errori, Frasi Parziali).

### Modifiche ai Componenti

#### 1. WizardApp.tsx
Aggiunto state e handler per gestire il preview:

```typescript
const [previewModuleId, setPreviewModuleId] = useState<string | null>(null);

const handlePreviewModule = (moduleId: string) => {
  setPreviewModuleId(moduleId);
};

<CenterPanel
  onPreviewModule={handlePreviewModule}  // ← NUOVO
  // ...altri props
/>

<RightPanel
  previewModuleId={previewModuleId}      // ← NUOVO
  availableModules={availableModules}    // ← NUOVO
  // ...altri props
/>
```

#### 2. CenterPanel.tsx
Aggiunto callback quando si clicca una card:

```typescript
// Props aggiunta
onPreviewModule?: (moduleId: string) => void;

// Nel render delle card dell'accordion
<div
  onClick={() => {
    setSelectedModule(module);
    onPreviewModule?.(module.id);  // ← NUOVO: notifica WizardApp
  }}
  className={/* ... */}
>
```

#### 3. RightPanel.tsx
Implementata logica di preview con dialoghi predefiniti:

```typescript
// Props aggiunte
previewModuleId?: string | null;
availableModules?: FakeModuleTemplate[];

// Logica di rendering
const previewModule = previewModuleId
  ? availableModules.find(m => m.id === previewModuleId)
  : null;

// Se c'è un modulo in preview, mostra i suoi dialoghi
if (previewModule) {
  const dialogs = getModuleDialogs(previewModule, activeScenario);
  return renderDialogs(dialogs);
}
// Altrimenti mostra i dialoghi generati (se disponibili)
else if (messages) {
  return generateDialogFromMessages(messages, activeScenario);
}
// Default: placeholder
else {
  return renderEmptyState();
}
```

#### 4. Dialoghi Predefiniti Aggiunti
Il RightPanel ora include dialoghi specifici per i task più comuni:

**booking-restaurant (Prenota Ristorante):**
- Happy Path: Prenotazione completa in un messaggio
- Partial: Bot chiede chiarimenti su orario
- Error: Gestione numero ospiti fuori range

**haircut-appointment (Appuntamento Parrucchiere):**
- Happy Path: Data e servizio forniti subito
- Partial: Bot chiede orario specifico
- Error: Gestione data passata

**order-delivery (Ordine Consegna):**
- Happy Path: Ordine e indirizzo completi
- Partial: Bot chiede tipo pizza specifico
- Error: Gestione indirizzo incompleto

**Altri task:**
- Dialoghi generici basati su `module.examples`

### Flusso Utente Aggiornato

#### Quando Euristica NON Trovata:

```
1. User inserisce input → Nessun match automatico
2. CenterPanel mostra:
   - Header "Nessun task selezionato"
   - Bottone "Genera nuovo task" (in alto a destra)
   - Accordion "Cerca in libreria" (chiuso)

3. User apre accordion:
   - Lista 20 task disponibili come card

4. User clicca su card "Appuntamento Parrucchiere":
   ├─ Card si evidenzia con bordo blu + checkmark
   ├─ Header diventa "Task selezionato"
   ├─ Appare bottone verde "Usa Appuntamento Parrucchiere"
   └─ RightPanel MOSTRA SUBITO dialoghi esempio ← NOVITÀ!

5. RightPanel mostra 3 tab:
   ├─ Happy Path: "Giovedì alle 15" → "Solo taglio" → Completato
   ├─ Frasi Parziali: "Giovedì" → "Che ora?" → "15:00"
   └─ Errori: "Ieri" → "Data passata!" → "Domani"

6. User può:
   ├─ Cambiare tab per vedere scenari diversi
   ├─ Selezionare altra card (preview si aggiorna)
   ├─ Click "Usa Appuntamento Parrucchiere" → handleSelectModule()
   └─ Click "Genera nuovo task" → handleProceedFromEuristica()
```

### Vantaggi della Feature

1. **Feedback Immediato:** L'utente vede subito come funzionerà il task
2. **Migliore Scelta:** Può confrontare più task prima di decidere
3. **UX Migliorata:** Niente pannello vuoto durante selezione
4. **Preview Interattiva:** Può switchare tra scenari in tempo reale

### Come Testare

1. Inserisci input generico: "xyz random"
2. Wizard va in stato "euristica_non_trovata"
3. Apri accordion "Cerca in libreria"
4. Clicca card "Appuntamento Parrucchiere"
5. ✅ Verifica che RightPanel mostri dialoghi subito
6. Clicca tab "Errori"
7. ✅ Verifica che dialogo cambi scenario
8. Clicca altra card (es: "Prenota Ristorante")
9. ✅ Verifica che RightPanel aggiorni con nuovi dialoghi

### Compatibilità

Questa feature è **completamente retrocompatibile**:
- Se `previewModuleId` è null, comportamento come prima
- Se `messages` sono presenti, vengono mostrati
- I dialoghi predefiniti sono fallback, sostituibili con API reali

---

**Versione:** 1.3.0
**Data:** 2026-02-06
**Autore:** Task Builder AI Team
**Ultima Modifica:** Correzioni UI (icone, payoff, pulsanti)
