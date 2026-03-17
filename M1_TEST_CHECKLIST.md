# M1 Test Checklist - ProjectDomainModel + Mapper

## ✅ Obiettivo
Verificare che l'introduzione del dominio stabile non abbia rotto nessuna funzionalità esistente.

## 📋 Checklist di Regressione

### 1. Caricamento Progetto
- [ ] Aprire un progetto esistente
- [ ] Verificare che il progetto si carichi correttamente
- [ ] Verificare che tutti i task siano visibili nel flowchart
- [ ] Verificare che tutti i nodi siano posizionati correttamente
- [ ] Verificare che tutti gli edge siano visibili

### 2. Salvataggio Progetto
- [ ] Modificare qualcosa nel progetto (es. aggiungere un task)
- [ ] Cliccare "Salva Progetto"
- [ ] Verificare che il salvataggio completi senza errori
- [ ] Verificare che non compaiano errori in console
- [ ] Verificare che il messaggio di successo appaia

### 3. Reload
- [ ] Dopo aver salvato, ricaricare la pagina (F5)
- [ ] Verificare che il progetto si carichi correttamente
- [ ] Verificare che tutte le modifiche siano state salvate
- [ ] Verificare che non ci siano task orfani visibili

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
- [ ] Aggiungere uno slot (Enter dopo aver digitato)
- [ ] Verificare che lo slot venga creato
- [ ] Salvare la grammar
- [ ] Ricaricare e verificare che la grammar sia stata salvata

### 6. Editing Flowchart
- [ ] Aggiungere un nuovo nodo nel flowchart
- [ ] Aggiungere un nuovo task al nodo
- [ ] Creare un edge tra due nodi
- [ ] Verificare che tutto sia visibile correttamente
- [ ] Salvare il progetto
- [ ] Ricaricare e verificare che le modifiche siano state salvate

### 7. Verifica Console
- [ ] Aprire la console del browser (F12)
- [ ] Verificare che non ci siano errori rossi
- [ ] Verificare che non ci siano warning critici
- [ ] Verificare che i log esistenti funzionino ancora

### 8. Verifica Test Automatici
- [ ] Eseguire: `npm test -- tests/domain/project --run`
- [ ] Verificare che tutti i test passino (7 test totali)

## ✅ Criteri di Successo
- Tutti i test automatici passano
- Nessun errore in console
- Tutte le funzionalità elencate funzionano come prima
- Nessuna regressione visibile

## 📝 Note
- Il mapper è stato introdotto ma **NON ancora usato** nel codice
- Questo è solo un passo preparatorio per M2
- Se qualcosa non funziona, è probabilmente un problema pre-esistente, non causato da M1
