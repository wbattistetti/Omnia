# Omnia — Sintesi piattaforma e differenziazione

Documento orientato a **cosa fa** il prodotto nel suo stato attuale (dal codice e dalla documentazione interna) e **perché** può risultare distintivo rispetto a soluzioni conversazionali “solo LLM” o a builder generici.

---

## 1. Cos’è Omnia (in una frase)

**Omnia è un ambiente di progettazione e runtime per dialoghi guidati da task**, in cui un flusso conversazionale è modellato come **albero di task / grafo** (TaskTree, flowchart), con **compilazione** verso strutture eseguibili, **motori di riconoscimento** eterogenei (regex, euristiche, NER, LLM dove serve) e **regole di stato** (step, escalation, conferme, limiti di ripetizione).

Non è “una chat con system prompt”: è un **sistema strutturato** che combina modellazione esplicita, generazione assistita e motori dedicati.

---

## 2. Cosa fa la piattaforma (funzionalità principali)

### 2.1 Authoring e workspace

- **Progetti** con dati globali, traduzioni e workspace a tab (dock) per più **flow / task flow**.
- **Editor di task** con messaggi, condizioni, validazioni, transizioni; integrazione con **Response Editor** e simulatori (bubble chat, scenari non interattivi).
- **Subflow (sottoflusso)**: composizione gerarchica dei flussi con semantica esplicita di binding tra parent e figlio (vedi normativa in `SEMANTICA_TASK_VARIABLES_E_SUBFLOW.md`).

### 2.2 Compilazione ed esecuzione “typed”

- **Compiler di flowchart** (lato servizi VB.NET `ApiServer`: `compile-flow`, `compile-ddt`, `run-ddt`) che trasforma nodi/edges e definizioni DDT/TaskTree in **strutture runtime** (task map, entry task, istanze validate).
- **Dialogue Engine (DDT Engine)**: orchestrazione del turno (`GetNextData`, risposte, escalation, stato) con possibilità di **engine parallelo / feature flag** per migrazione controllata.

### 2.3 Grammar Flow (G2)

- **Grammar Flow Engine** (VB.NET): compilazione di grammatiche a grafo e interpretazione con navigazione, backtracking controllato, memoization, tipi di edge (sequential / alternative / optional), garbage words, estrazione di **bindings** verso variabili di flusso tramite `slotBindings` (allineato alla semantica documentata per GrammarFlow).

### 2.4 Generazione e intelligenza strutturata

- **TaskTree Generation Pipeline** (architettura a **7 layer** in `docs/ARCHITECTURE.md`): orchestratore, contract, vincoli, motori, escalation, test, messaging — per produrre **parser conversazionali completi** da descrizioni ad alto livello, con enfasi su funzioni pure e testabilità.
- **Structured design pipeline** (backend, es. `StructuredDesignPipelineService`): flusso esplicito in due fasi — **estrazione LLM → IR JSON** e **compilazione deterministica multi-piattaforma senza secondo passaggio LLM sull’IR**, per ridurre deriva e rendere l’output rivendicabile e ripetibile.

### 2.5 Agenti vocali e provider esterni

- Integrazione con **ElevenLabs** (proxy HTTP VB.NET, WebSocket, registry sessioni) e flussi **ConvAI / provisioning** lato UI e API, per collegare il comportamento dialogico progettato in Omnia a runtime vocali reali.
- **Speech recognition** e cataloghi **LLM/TTS** nelle impostazioni runtime dell’agente IA.
- **Delega a IA esterna governata:** il flusso resta **deterministico** a livello di grafo; i passi **AI Agent** delegano a modelli o agenti cloud in modo **confinato** (regole compilate, risposta JSON, uscita `completed` / `in_progress`). Dettaglio e riferimenti: `PIATTAFORMA_IA_DELEGATION_GOVERNED.md`.

### 2.6 Qualità e regressioni

- **Use case** legati al debugger/regressioni conversazionali (snapshot da messaggi debugger, albero use case), orientati a **ripetibilità** dei comportamenti rispetto a un chatbot “libero”.

**Wizard e template libreria:** dalla label della riga, le euristiche possono proporre il **template di catalogo più affine**; aprendo il TaskTree, il flusso può **adattare** quel template al contesto (vedi `PIATTAFORMA_WIZARD_E_MATCHING_TEMPLATE.md`).

### 2.7 Stack operativo (macro)

- Front-end **React / Vite / TypeScript** con stato progetto centralizzato e componenti complessi (Flow, Dock, Monaco, React Flow).
- Backend **Node (Express)**, servizi **Python (FastAPI)** dove indicato negli script, **Redis**, database (**PostgreSQL**, **MongoDB** a seconda delle parti del sistema).
- Servizi **VB.NET** per compilazione ed engine ad alte prestazioni o legacy integration.

---

## 3. Dove può risultare innovativa rispetto a “quello che c’è in giro”

*(Confronto qualitativo: mercato pieno di chatbot LLM-only, voice bot template, o piattaforme RAG. Le osservazioni seguenti descrivono **punti di forza del design Omnia**, non una comparativa commerciale su singoli vendor.)*

| Aspetto | Approccio tipico sul mercato | Angolo Omnia |
|--------|-------------------------------|--------------|
| **Controllo del dialogo** | Prompt + tool; comportamento emergente | **Modello esplicito** (task, condizioni, subflow, variabili con identità stabile), più adatto a **conformità** e percorsi obbligati |
| **Determinismo vs LLM** | Tutto generato dal modello ad ogni turno | **Separazione netta**: IR/compilazione **deterministica** dove possibile; LLM per estrazione o motori **localizzati**, non come unica fonte di verità |
| **Riconoscimento input** | Spesso solo classificazione intent | **Motori multipli** (regex, NER, LLM, euristiche) e **grammar graph** per linguaggio controllato |
| **Manutenzione** | Prompt lunghi e fragili | **Pipeline a layer** con contratti, test generati, messaggistica strutturata — orientata a **evoluzione** e **test automatici** |
| **Voce** | App wrapper su ASR+LLM+TTS | **Collegamento progettuale** tra editor conversazionale e **stack vocale** (es. ElevenLabs/ConvAI) con mapping e provisioning espliciti |

In sintesi: l’innovazione percepibile non è “abbiamo messo l’IA”, ma **IA + ingegneria del dialogo** (compilazione, vincoli, motori, grammatiche, semantica delle variabili) per **conversazioni governabili** in contesti dove errore o ambiguità costano (customer care strutturato, raccolta dati, processi, voce in produzione).

---

## 4. Documentazione tecnica di riferimento

- Architettura pipeline generazione: `docs/ARCHITECTURE.md`, `docs/LAYER_DIAGRAM.md`
- Semantica task, variabili, subflow: `docs/SEMANTICA_TASK_VARIABLES_E_SUBFLOW.md`
- Grammar Flow Engine: `VBNET/GrammarFlowEngine/README.md`
- ApiServer / compilazione ed ElevenLabs: `VBNET/ApiServer/README.md`
- Nuovo DDT Engine (parallelo): `src/components/DialogueEngine/ddt/README_NEW_ENGINE.md`

---

## 5. Limiti di questo documento

- Non sostituisce roadmap o materiale commerciale: descrive **capacità riscontrabili nel repository**.
- L’“innovazione” va intesa come **differenziazione architetturica e di metodo**, da validare su mercato e competitor specifici.

*Ultimo aggiornamento: documento introdotto per sintesi piattaforma; allineare alle release quando cambiano feature visibili all’utente.*
