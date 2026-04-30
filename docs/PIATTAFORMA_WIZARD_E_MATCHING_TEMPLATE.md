# Omnia — Wizard, task libreria e specializzazione sul contesto (riferimenti al codice)

Questo documento lega la value proposition (“parto da un task, il sistema propone il template di libreria più affine e lo specializzo per il mio contesto”) agli **asset implementati** nel repository. È complementare a `PIATTAFORMA_OMNIA_SINTESI.md` e a `PIATTAFORMA_PITCH_INVESTITORI.md`.

---

## 1. Cosa fa l’utente in prodotto

1. Crea o modifica una **riga / task** sul flow (es. etichetta che descrive cosa vuole raccogliere o chiedere).
2. Il sistema calcola **euristiche sulla label** (tipo di task e, dove applicabile, **quale template della libreria** è più vicino semanticamente o lessicalmente).
3. All’apertura dell’editor del TaskTree, se è stato individuato un **template di libreria** e il task è ancora una **scocca vuota**, l’UI può entrare in flusso **adattamento / wizard** usando quel `templateId` come base da **contestualizzare** (nome visualizzato, passi, dati) senza ripartire da zero.

Questo è un **differenziale operativo**: accelerazione + coerenza con i template curati, non solo generazione libera.

---

## 2. Dove sta nel codice (flusso principale)

### 2.1 Analisi centralizzata della label (`RowHeuristicsService`)

**File:** `src/services/RowHeuristicsService.ts`

- **`analyzeRowLabel(label, projectId)`** è il punto unico che implementa le euristiche descritte nei commenti:
  - separazione linguistica (Part A / Part B) per distinguere aspetti del tipo di task vs contenuto utile al match del template;
  - **classificazione del `TaskType`** (es. embedding-based tramite `EmbeddingService.findBestMatch` su embeddings di tipo, con fallback a pattern se il servizio embedding non è disponibile);
  - per `UtteranceInterpretation`, segmentazione **V–X–Y** e uso del segmento normalizzato per il **matching dei template** via embedding (soglie esplicite nel file, es. 0.70 per template).
- Il risultato include **`templateId`** quando un template della libreria viene associato alla riga.

Questo è il cuore dell’idea **identificare il task libreria più affine** in modo automatico a partire dal testo della riga.

### 2.2 Match template alternativo / complementare (`TaskTemplateMatcherService`)

**File:** `src/services/TaskTemplateMatcherService.ts`

- Implementa **Euristica 2** in senso classico: normalizzazione label, sinonimi euristici da `TemplateTranslationsService`, scoring token-based (`scoreCandidate`), match **exact / keywords**.
- Documentato come usato da Response Editor e flussi di aggiornamento riga (`useNodeRowManagement`). È parte dell’ecosistema di **allineamento label ↔ catalogo template**.

### 2.3 Applicazione delle euristiche alla riga (handler)

**File:** `src/components/Flowchart/rows/NodeRow/application/RowHeuristicsHandler.ts`

- **`analyzeRowLabel`** delega a `RowHeuristicsService.analyzeRowLabel` e collega il risultato ai metadati della riga.

**File:** `src/components/Flowchart/rows/NodeRow/hooks/useNodeRowEventHandlers.ts`

- Chiama l’handler quando l’utente aggiorna il testo della riga, così **`heuristics.templateId`** e **`heuristics.type`** possono aggiornarsi in tempo reale.

### 2.4 Apertura editor: template trovato → modalità adattamento

**File:** `src/components/Flowchart/rows/NodeRow/application/TaskTreeOpener.ts`

- **`open()`** per `UtteranceInterpretation`: legge `row.heuristics` (`metaTemplateId`, `metaTaskType`).
- Se esiste **`metaTemplateId`**, il tipo è coerente e il task in repository è ancora una **scocca “pristine”** (senza `templateId` propri, senza steps, senza subTasks — vedi `isPristineStandaloneTask`), viene invocato **`handleTemplateFound`**.
- **`handleTemplateFound`**:
  - resetta lo stato del wizard (`TaskBuilderAIWizard/store/wizardStore`);
  - carica il template da **`DialogueTaskService`** (cache + eventuale **`loadTemplateFromProject`** per template legati al progetto);
  - apre l’editor con  
    **`taskWizardMode: 'pending'`**,  
    **`contextualizationTemplateId`**,  
    **`contextualizationTemplateName`**,  
    **`taskLabel`**  
    così l’UI può offrire **adattamento** partendo dal template libreria identificato dall’euristica.

Questo è il collegamento diretto tra **match automatico** e **wizard che parte dal template libreria**.

### 2.5 Wizard AI Task Builder (modalità adattamento)

**Cartella:** `TaskBuilderAIWizard/`

- **`hooks/useWizardOrchestrator.ts`**: espone **`startAdaptation(templateId)`** — avvio esplicito dell’adattamento sul template scelto.
- **`hooks/useWizard.ts`**: in **ADAPTATION MODE**, quando `templateId` è disponibile, lo orchestratore avvia l’adattamento (vedi effetti che dipendono da `mode`, `templateId`, `taskLabel`).

Qui si realizza la fase di **specializzazione per il contesto** (contenuto del task / progetto) rispetto al clone del template di libreria.

### 2.6 Euristiche lato backend (template DDT / menzione campi)

**File:** `backend/template_heuristics.js`

- Matching deterministico per selezione template da descrizione testuale: **`extractMentionedFields`**, **`scoreTemplate`**, sinonimi/pattern — utile dove il flusso passa dal backend per costruzione template senza affidarsi solo all’LLM.

Non sostituisce il flusso UI sopra, ma **rinforza** il tema catalogo template + scoring.

---

## 3. Riassunto per investitori / prodotto (una frase tecnica)

**Il prodotto non si limita a “avere dei template”: calcola automaticamente il template di libreria più affine alla label del task (embeddings + euristiche su riga), e apre un percorso di wizard/adattamento (`TaskTreeOpener` + `TaskBuilderAIWizard`) che specializza quel template per il contesto del progetto — con punti di estensione documentati nel codice (`RowHeuristicsService`, `DialogueTaskService`, store wizard).**

---

## 4. Riferimenti incrociati

| Concetto | File principale |
|----------|------------------|
| Match label → tipo + templateId | `src/services/RowHeuristicsService.ts` |
| Match sinonimi/keywords su catalogo | `src/services/TaskTemplateMatcherService.ts` |
| Embeddings / similarità | `src/services/EmbeddingService.ts` |
| Aggiornamento euristiche su riga | `RowHeuristicsHandler.ts`, `useNodeRowEventHandlers.ts` |
| Open editor + template contestualizzato | `TaskTreeOpener.ts` (`handleTemplateFound`) |
| Wizard adattamento | `TaskBuilderAIWizard/hooks/useWizard.ts`, `useWizardOrchestrator.ts` |
| Heuristiche template backend | `backend/template_heuristics.js` |

---

*Aggiornare questo documento se cambiano soglie embedding, nomi di `taskWizardMode`, o il contratto tra ResponseEditor e wizard store.*
