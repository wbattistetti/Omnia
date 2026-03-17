# M3 Test Checklist - Project Migration v1→v2

## ✅ Obiettivo
Verificare che l'introduzione del sistema di migrazione non abbia rotto nessuna funzionalità esistente.

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
- [ ] **Verificare in console il log `[Save][M3-Migration] ✅ Project migrated/normalized (DRY-RUN)`**
- [ ] Verificare che i log mostrino:
  - `detectedVersion`: versione rilevata (1.0 o 2.0)
  - `migratedVersion`: versione dopo migrazione (sempre 2.0)
  - `migrated`: true se era v1.0, false se era già v2.0
  - `warningsCount`: numero di warning (se presenti)
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
- [ ] **Verificare in console il log M3-Migration**
- [ ] Ricaricare e verificare che le modifiche siano state salvate

### 7. Verifica Console - Log M3
- [ ] Aprire la console del browser (F12)
- [ ] Salvare il progetto
- [ ] **Cercare il log `[Save][M3-Migration] ✅ Project migrated/normalized (DRY-RUN)`**
- [ ] Verificare che i dati siano corretti:
  - `detectedVersion`: deve essere '1.0' o '2.0'
  - `migratedVersion`: deve essere sempre '2.0'
  - `migrated`: true se era v1.0, false se era già v2.0
- [ ] Se ci sono warning, verificare che siano loggati correttamente
- [ ] Verificare che non ci siano errori o warning critici da M3-Migration

### 8. Verifica Test Automatici
- [ ] Eseguire: `npm test -- tests/domain/project tests/services/project-save tests/migrations --run`
- [ ] Verificare che tutti i test passino (18 test totali: 7 domain + 3 orchestrator + 8 migrations)

## ✅ Criteri di Successo
- Tutti i test automatici passano (18/18)
- Nessun errore in console
- Il log `[Save][M3-Migration]` appare correttamente con dati corretti
- Tutte le funzionalità elencate funzionano come prima
- Nessuna regressione visibile

## 📝 Note
- La migrazione è in **DRY-RUN**: normalizza i dati ma **NON li persiste**
- Il save flow esistente continua a funzionare normalmente
- Il log M3-Migration serve solo per caratterizzazione (verificare che la migrazione funzioni)
- Se il log mostra `migrated: true`, significa che il progetto era v1.0 e è stato migrato a v2.0
- Se il log mostra `migrated: false`, significa che il progetto era già v2.0 e è stato solo normalizzato

## 🔍 Cosa verificare nel log M3-Migration
Quando salvi un progetto, dovresti vedere in console:
```
[Save][M3-Migration] ✅ Project migrated/normalized (DRY-RUN) {
  projectId: 'proj_xxx',
  detectedVersion: '2.0',      // ← Versione rilevata
  migratedVersion: '2.0',      // ← Versione dopo migrazione (sempre 2.0)
  migrated: false,              // ← true se era v1.0, false se era già v2.0
  warningsCount: 0              // ← Numero di warning (se presenti)
}
```

Se `migrated: true`, il progetto era v1.0 e è stato migrato a v2.0.
Se `migrated: false`, il progetto era già v2.0 e è stato solo normalizzato (rimossi orfani, fix condizioni, ecc.).
