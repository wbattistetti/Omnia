# Orchestratore DDT – Logica e Implementazione

## Cos'è l'Orchestratore DDT

L'orchestratore DDT (Data Dialogue Template) è una logica frontend che guida passo-passo la generazione di template di dialogo strutturati per acquisire dati tramite AI conversazionale. Gestisce la sequenza di step, le chiamate API e l'aggiornamento dello stato, fino alla creazione del template finale pronto per la UI o il salvataggio.

---

## Pipeline degli Step

L'orchestratore segue una pipeline a step, ognuno dei quali arricchisce progressivamente la struttura del DDT:

1. **structure**  
   Genera la struttura base del DDT tramite AI, a partire dal tipo di dato richiesto (es: “data di nascita”).  
   API: `/api/ddt/structure`  
   Output: `{ ddt, messages }`

2. **constraints**  
   Arricchisce i constraints della struttura generata, chiedendo all’AI di completare label, payoff, summary, ecc.  
   API: `/api/ddt/constraint`  
   Output: struttura DDT aggiornata

3. **scripts**  
   Genera gli script di validazione (JS, Python, TS) per ogni constraint.  
   API: `/api/ddt/constraint/script`  
   Output: struttura DDT aggiornata con scripts e test

4. **messages**  
   Genera i messaggi utente (spoken keys) per tutte le chiavi della struttura.  
   API: `/api/ddt/messages`  
   Output: oggetto `messages` (spokenKey → testo)

5. **assemble**  
   Assembla il DDT finale, patchando le spoken key, inserendo scripts e validando la struttura.  
   Output: `{ ddt, messages }` finale

6. **done**  
   Step finale: il DDT è pronto per la UI o il salvataggio.

7. **error**  
   Step di errore, se qualcosa va storto.

---

## Stato e Tipi

```ts
export type DDTGenerationStep =
  | 'structure'
  | 'constraints'
  | 'scripts'
  | 'messages'
  | 'assemble'
  | 'done'
  | 'error';

export interface DDTOrchestratorState {
  step: DDTGenerationStep;
  structure?: any;
  constraints?: any[];
  scripts?: { [constraintId: string]: any };
  messages?: Record<string, string>;
  finalDDT?: any;
  error?: string;
}
```

---

## Funzionamento (useDDTOrchestrator)

- Lo stato viene aggiornato a ogni step.
- Ogni step chiama una funzione asincrona che effettua una fetch verso l’API corrispondente.
- In caso di errore, lo stato passa a `error` e viene mostrato il messaggio.
- È possibile riprovare uno step tramite la funzione `retry`.

---

## Prompt AI

Ogni step usa un prompt specifico per guidare l’AI nella generazione della struttura, dei constraints, degli script e dei messaggi.  
Questi prompt sono definiti in `prompts.ts` e sono altamente strutturati per ottenere risposte JSON valide e coerenti.

---

## Sequenza Operativa

1. **start(meaning, desc)**
   - Step 1: `fetchStructure(meaning, desc)` → struttura base
   - Step 2: `enrichConstraints(ddt)` → constraints arricchiti
   - Step 3: `generateScripts(ddt)` → scripts e test
   - Step 4: `batchMessages(spokenKeys)` → messaggi utente
   - Step 5: `assembleFinalDDT(ddt, messages)` → DDT finale

---

## File Principali Coinvolti

- `useDDTOrchestrator.ts`: logica principale orchestratore
- `fetchStructure.ts`: step 1, struttura base
- `enrichConstraints.ts`: step 2, constraints
- `generateScripts.ts`: step 3, scripts
- `batchMessages.ts`: step 4, messaggi
- `assembleFinalDDT.ts`: step 5, assemblaggio finale
- `prompts.ts`: prompt AI per ogni step
- `types.ts`: tipi condivisi

---

## Dettagli Implementativi

### fetchStructure.ts
Effettua una POST a `/api/ddt/structure` con il tipo di dato richiesto e una descrizione opzionale. Restituisce la struttura DDT e i messaggi generati dall’AI.

### enrichConstraints.ts
Per ogni constraint nella struttura, se mancano informazioni chiave, effettua una POST a `/api/ddt/constraint` per arricchirlo tramite AI.

### generateScripts.ts
Per ogni constraint, se mancano script, effettua una POST a `/api/ddt/constraint/script` per generare script di validazione e test.

### batchMessages.ts
Effettua una POST a `/api/ddt/messages` con le spoken key da generare, ottenendo i messaggi utente.

### assembleFinalDDT.ts
Patcher e valida la struttura finale, garantendo spoken key uniche e inserendo i messaggi generati.

### prompts.ts
Contiene i prompt dettagliati per ogni step, ottimizzati per ottenere risposte AI coerenti e strutturate.

---

## Note

- L’orchestratore è pensato per essere estendibile: puoi aggiungere step, validazioni o prompt custom.
- Tutte le chiamate sono asincrone e gestiscono errori e retry.
- La struttura DDT prodotta è pronta per essere usata in UI di data collection conversazionale. 