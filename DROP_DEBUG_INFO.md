# Drop Debug - File Modificati

## File Modificati in Questa Sessione

1. **src/components/ActEditor/ResponseEditor/ActionRowDnDWrapper.tsx**
   - Rinominato `onDropNewAction` → `onDropNewTask`
   - Rinominato `actionIdx` → `taskIdx`
   - Rinominato `action` prop → `task` prop
   - Aggiunto supporto legacy per retrocompatibilità
   - Aggiunto log di debug per drop (gated da `localStorage.getItem('debug.drop') === '1'`)

2. **src/components/ActEditor/ResponseEditor/StepEditor.tsx**
   - Aggiornato per usare `onDropNewTask` invece di `onDropNewAction`
   - Aggiunto log di debug per drop (gated da `localStorage.getItem('debug.drop') === '1'`)
   - Rimosso log verbose non necessari

3. **src/components/ActEditor/ResponseEditor/CanvasDropWrapper.tsx**
   - Rinominato `onDropAction` → `onDropTask`
   - Rimosso completamente il rettangolo azzurro grande
   - Ora è un wrapper invisibile che gestisce solo il drop

4. **src/components/ActEditor/ResponseEditor/PanelEmptyDropZone.tsx**
   - Rinominato `onDropAction` → `onDropTask`
   - Rimosso il rettangolo grande, mostra solo testo discreto

5. **src/components/ActEditor/ResponseEditor/ActionRow.tsx**
   - Aggiunto supporto per `isDragging` prop
   - Mostra bordo quando viene trascinato
   - Rimosso log verbose non necessari
   - Fix per chiudere editing con X

6. **src/components/ActEditor/ResponseEditor/utils/normalize.ts**
   - Migliorato `normalizeTaskFromViewer` per gestire meglio gli oggetti action dal catalogo

7. **src/components/ActEditor/ResponseEditor/useActionCommands.ts**
   - Aggiunto log di debug dettagliati per drop (gated da `localStorage.getItem('debug.drop') === '1'`)

## Come Abilitare i Log di Debug per il Drop

Per abilitare i log di debug specifici per il drop, esegui nella console del browser:

```javascript
localStorage.setItem('debug.drop', '1');
```

Poi ricarica la pagina. I log mostreranno:
- Quando viene ricevuto un drop
- La posizione di inserimento calcolata
- Il task normalizzato
- L'array dei task dopo l'inserimento

Per disabilitare:
```javascript
localStorage.removeItem('debug.drop');
```

## Problemi da Investigare

1. **Task non appare nella posizione corretta dopo il drop**
   - I log mostreranno `to.taskIdx`, `position`, e `calculatedInsertIdx`
   - Verificare che `insertIdx` sia corretto rispetto alla posizione visuale

2. **Rettangoli che appaiono in posizioni diverse**
   - Verificare che non ci siano altri componenti che mostrano rettangoli
   - Il `CanvasDropWrapper` e `PanelEmptyDropZone` sono stati già corretti

