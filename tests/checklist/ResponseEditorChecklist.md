# Response Editor - Validation Checklist

## Pre-Refactoring Baseline

### Screenshots
- [ ] Screenshot: Response Editor - Personality view
- [ ] Screenshot: Response Editor - Behaviour view
- [ ] Screenshot: Message Review panel
- [ ] Screenshot: Data Extraction Editor
- [ ] Screenshot: Chat Simulator

### Export Data
- [ ] Export JSON: Project with complex task (multiple nodes, steps, escalations)
- [ ] Export JSON: Project with disabled steps
- [ ] Export JSON: Project with deleted steps
- [ ] Export JSON: Project with modified prompts

### Video Recording
- [ ] Video: Complete editing flow (open → edit → save → close → reopen)
- [ ] Video: Step deletion flow
- [ ] Video: Step disable/enable flow
- [ ] Video: Prompt editing flow

---

## Post-Refactoring Validation

### ✅ Gestione Step

#### Disattivazione Step
- [ ] Disattivare step "noMatch" → step mostra bordo dashed e testo barrato
- [ ] Chiudere editor → riaprire → step ancora disattivato
- [ ] Checkbox toolbar mostra "X" quando step è attivo
- [ ] Checkbox toolbar mostra "✓" quando step è disattivato
- [ ] Toolbar NON visibile per step obbligatori (es. "start")

#### Cancellazione Step
- [ ] Cancellare step "noMatch" → step scompare immediatamente
- [ ] Chiudere editor → riaprire → step ancora cancellato
- [ ] Pulsante "Restore steps" appare quando ci sono step cancellati
- [ ] Dropdown "Restore steps" mostra step cancellati
- [ ] Ripristinare step → step riappare in ordine corretto
- [ ] Cancellazione definitiva (trash nel dropdown) → step non può essere ripristinato

#### Step Vuoti
- [ ] Cancellare tutti gli step per un nodo → nodo ha steps = {}
- [ ] Chiudere editor → riaprire → steps ancora vuoti (NON clonati dal template)

---

### ✅ Modifica Messaggi

#### Message Review
- [ ] Modificare prompt in Message Review → testo aggiornato immediatamente
- [ ] Salvare (in memoria) → traduzione aggiornata
- [ ] Chiudere editor → riaprire → testo ancora modificato
- [ ] Salvare progetto (DB) → riaprire progetto → testo ancora modificato

#### Chat Simulator
- [ ] Modificare prompt → avviare chat → chat mostra testo modificato
- [ ] Modificare prompt in chat → testo aggiornato in editor
- [ ] Allineamento: editor e chat mostrano stesso testo

---

### ✅ Data Extraction Editor

#### Modifica Profile
- [ ] Modificare regex → salvare → regex salvata
- [ ] Modificare NLP profile → salvare → profile salvato
- [ ] Modificare examples → salvare → examples salvati
- [ ] Modificare synonyms → salvare → synonyms salvati
- [ ] Modificare format hints → salvare → format hints salvati
- [ ] Modificare post-process → salvare → post-process salvato

#### Testing
- [ ] Testare parsing → risultati corretti
- [ ] Aggiungere test case → test case salvato
- [ ] Eseguire test → risultati mostrati correttamente

---

### ✅ Behaviour Editor

#### Visualizzazione
- [ ] Step tabs visibili correttamente
- [ ] Step disattivati mostrano bordo dashed e testo barrato
- [ ] Step cancellati non appaiono
- [ ] Toolbar step funziona correttamente

#### Modifica Escalation
- [ ] Aggiungere escalation → escalation aggiunta
- [ ] Eliminare escalation → escalation eliminata
- [ ] Modificare escalation → modifiche salvate
- [ ] Aggiungere task a escalation → task aggiunto
- [ ] Eliminare task da escalation → task eliminato

---

### ✅ Chat Simulator

#### Funzionalità Base
- [ ] Avviare sessione → funziona
- [ ] Inviare messaggio utente → risposta bot corretta
- [ ] Visualizzare messaggi → formattazione corretta
- [ ] Chiudere sessione → funziona

#### Integrazione con Step
- [ ] Step disattivati → NON appaiono in chat
- [ ] Step cancellati → NON appaiono in chat
- [ ] Prompt modificati → chat mostra testo modificato

---

### ✅ Persistenza

#### In Memoria
- [ ] Modifiche in memoria → persistono dopo riavvio editor
- [ ] Flag _disabled → persistono dopo riavvio editor
- [ ] Step cancellati → persistono dopo riavvio editor
- [ ] Traduzioni modificate → persistono dopo riavvio editor

#### Database
- [ ] Salvataggio DB → dati corretti nel database
- [ ] Caricamento DB → dati corretti nell'editor
- [ ] Flag _disabled → persistono nel database
- [ ] Step cancellati → persistono nel database

---

### ✅ Performance

#### Tempo di Risposta
- [ ] Aprire editor → < 500ms
- [ ] Modificare step → < 100ms
- [ ] Salvare modifiche → < 200ms
- [ ] Rebuild TaskTree → < 300ms

#### Memoria
- [ ] Nessun memory leak durante editing prolungato
- [ ] Repository non accumula task obsoleti

---

## Regressioni da Verificare

### ❌ Regressioni Conosciute (da NON ripetere)
- [ ] Step cancellato riappare dopo riavvio editor
- [ ] Step disattivato si riattiva dopo riavvio editor
- [ ] Prompt modificato non si sincronizza con chat
- [ ] Traduzioni modificate si perdono

---

## Test Automatici

### Unit Tests
- [ ] `TaskRepository.refactored.test.ts` → tutti passano
- [ ] `buildTaskTree.refactored.test.ts` → tutti passano

### Integration Tests
- [ ] `ResponseEditor.integration.test.ts` → tutti passano

### Regression Tests
- [ ] `ResponseEditorRegression.test.ts` → tutti passano

### E2E Tests
- [ ] `step-management.e2e.test.ts` → tutti passano

---

## Validazione Parallela

### Feature Flag Validation
- [ ] Vecchio codice e nuovo codice producono stesso risultato
- [ ] Nessuna differenza tra merge profondo e aggiornamento diretto
- [ ] Log di validazione non mostrano discrepanze

---

## Conclusione

- [ ] Tutti i test automatici passano
- [ ] Tutte le funzionalità manuali verificate
- [ ] Nessuna regressione identificata
- [ ] Performance identica o migliore
- [ ] Pronto per deploy
