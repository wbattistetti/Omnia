# M2 Test Checklist - ProjectSaveOrchestrator (Dry-Run)

## ✅ Obiettivo
Verificare che l'introduzione del ProjectSaveOrchestrator in dry-run non abbia rotto nessuna funzionalità esistente.

## 📋 Checklist di Regressione

### 1. Caricamento Progetto
- [ ] Aprire un progetto esistente
- [ ] Verificare che il progetto si carichi correttamente
- [ ] Verificare che tutti i task siano visibili nel flowchart
- [ ] Verificare che tutti i nodi siano posizionati correttamente

### 2. Salvataggio Progetto (CRITICO)
- [ ] Modificare qualcosa nel progetto (es. aggiungere un task)
- [ ] Cliccare "Salva Progetto"
- [ ] Verificare che il salvataggio completi senza errori
- [ ] **Verificare in console il log `[Save][M2-Orchestrator] ✅ Save request prepared (DRY-RUN)`**
- [ ] Verificare che i contatori nel log siano corretti:
  - `tasksCount` deve corrispondere ai task referenziati (non orfani)
  - `conditionsCount` deve corrispondere alle condizioni
  - `templatesCount` e `variablesCount` possono essere 0 (saranno popolati in M4)
- [ ] Verificare che non compaiano errori in console
- [ ] Verificare che il messaggio di successo appaia

### 3. Reload
- [ ] Dopo aver salvato, ricaricare la pagina (F5)
- [ ] Verificare che il progetto si carichi correttamente
- [ ] Verificare che tutte le modifiche siano state salvate

### 4. Esecuzione Dialogue Engine
- [ ] Aprire il chat simulator
- [ ] Inviare un messaggio
- [ ] Verificare che il dialogue engine risponda correttamente
- [ ] Verificare che non ci siano errori in console

### 5. Editing Grammar
- [ ] Aprire un task con grammar flow
- [ ] Aprire l'editor grammar
- [ ] Verificare che la grammar si carichi correttamente
- [ ] Aggiungere un nodo (doppio click sul canvas)
- [ ] Verificare che il nodo venga creato
- [ ] Salvare la grammar
- [ ] Ricaricare e verificare che la grammar sia stata salvata

### 6. Editing Flowchart
- [ ] Aggiungere un nuovo nodo nel flowchart
- [ ] Aggiungere un nuovo task al nodo
- [ ] Creare un edge tra due nodi
- [ ] Verificare che tutto sia visibile correttamente
- [ ] Salvare il progetto
- [ ] **Verificare in console il log M2-Orchestrator con i nuovi contatori**
- [ ] Ricaricare e verificare che le modifiche siano state salvate

### 7. Verifica Console - Log M2
- [ ] Aprire la console del browser (F12)
- [ ] Salvare il progetto
- [ ] **Cercare il log `[Save][M2-Orchestrator] ✅ Save request prepared (DRY-RUN)`**
- [ ] Verificare che i contatori siano corretti:
  - `tasksCount` = numero di task referenziati (non orfani)
  - `conditionsCount` = numero di condizioni
- [ ] Verificare che non ci siano errori o warning da M2-Orchestrator
- [ ] Verificare che non ci siano errori rossi

### 8. Verifica Test Automatici
- [ ] Eseguire: `npm test -- tests/domain/project tests/services/project-save --run`
- [ ] Verificare che tutti i test passino (10 test totali: 7 domain + 3 orchestrator)

## ✅ Criteri di Successo
- Tutti i test automatici passano (10/10)
- Nessun errore in console
- Il log `[Save][M2-Orchestrator]` appare correttamente con contatori corretti
- Tutte le funzionalità elencate funzionano come prima
- Nessuna regressione visibile

## 📝 Note
- L'orchestratore è in **DRY-RUN**: prepara il payload ma **NON lo esegue**
- Il save flow esistente continua a funzionare normalmente
- Il log M2-Orchestrator serve solo per caratterizzazione (verificare che il payload sia corretto)
- Se il log mostra contatori sbagliati, è un problema da fixare prima di M4

## 🔍 Cosa verificare nel log M2-Orchestrator
Quando salvi un progetto, dovresti vedere in console:
```
[Save][M2-Orchestrator] ✅ Save request prepared (DRY-RUN) {
  projectId: 'proj_xxx',
  tasksCount: 8,        // ← Deve corrispondere ai task referenziati (non orfani)
  conditionsCount: 5,   // ← Deve corrispondere alle condizioni
  templatesCount: 0,    // ← OK se 0 (sarà popolato in M4)
  variablesCount: 0     // ← OK se 0 (sarà popolato in M4)
}
```

Se `tasksCount` non corrisponde ai task referenziati, c'è un problema nel mapper o nell'orchestratore.
