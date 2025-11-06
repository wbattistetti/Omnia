# 🧪 Test Guide - Internal Row Manager

## 📋 Prerequisiti
- Server di sviluppo in esecuzione (`npm run dev`)
- Browser aperto sull'applicazione

## 🚀 Step 1: Abilita il Feature Flag

### Opzione A: Console Browser (Consigliata)
1. Apri la **Console del browser** (F12 → Console)
2. Esegui questo comando:
```javascript
localStorage.setItem('feature.internalRowManager', 'true');
```
3. **Ricarica la pagina** (F5 o Ctrl+R)

### Opzione B: DevTools → Application
1. Apri **DevTools** (F12)
2. Vai su **Application** → **Local Storage**
3. Aggiungi:
   - Key: `feature.internalRowManager`
   - Value: `true`
4. **Ricarica la pagina**

---

## ✅ Step 2: Verifica che il Flag sia Attivo

Nella console del browser, dovresti vedere log quando crei un nodo:
```
🔒 [INTERNAL_ROW_MANAGER][ADD_ROW][START]
```

Se vedi questi log, il nuovo hook è attivo! ✅

---

## 🎯 Step 3: Test Scenario Base

### Test 1: Auto-append Sequenziale
1. **Crea un nuovo nodo** (click su canvas o crea un Agent Act)
2. **Il nodo dovrebbe essere vuoto**
3. **Inizia a scrivere** nella prima riga (es: "Chiedi nome")
4. **Premi Enter**
   - ✅ Dovrebbe apparire una nuova riga vuota sotto
   - ✅ Il focus dovrebbe andare sulla nuova riga
   - ✅ Nella console vedi: `🚀 [INTERNAL_ROW_MANAGER] Started continuousBuilding`
5. **Continua a scrivere** nella nuova riga (es: "Chiedi email")
6. **Premi Enter di nuovo**
   - ✅ Dovrebbe apparire un'altra riga vuota
   - ✅ Il focus dovrebbe andare sulla nuova riga
   - ✅ Continua ad auto-appendare

### Test 2: Disattivazione Continuous Building
1. **Mentre stai scrivendo** (dopo almeno 2 righe)
2. **Clicca sul canvas** (fuori dal nodo)
   - ✅ Il `continuousBuilding` dovrebbe disattivarsi
   - ✅ Nella console vedi: `🛑 [INTERNAL_ROW_MANAGER] Stopped continuousBuilding`
3. **Clicca di nuovo sul nodo** e premi Enter
   - ❌ NON dovrebbe auto-appendare (perché `continuousBuilding` è disattivo)

### Test 3: Riattivazione Continuous Building
1. **Clicca sull'ultima riga vuota** del nodo
2. **Inizia a scrivere**
   - ✅ Dovrebbe riattivare `continuousBuilding`
   - ✅ Nella console vedi: `🚀 [INTERNAL_ROW_MANAGER] Started continuousBuilding`
3. **Premi Enter**
   - ✅ Dovrebbe auto-appendare di nuovo

### Test 4: Click su Riga Esistente
1. **Crea un nodo con 2-3 righe piene**
2. **Clicca su una riga esistente** (non vuota)
   - ✅ `continuousBuilding` dovrebbe disattivarsi
   - ✅ Nella console vedi: `🛑 [INTERNAL_ROW_MANAGER] Stopped continuousBuilding: editing existing row`

---

## 🔍 Step 4: Verifica Logs

Nella console del browser, cerca questi log:

### Log Attesi (Successo):
```
🔒 [INTERNAL_ROW_MANAGER][ADD_ROW][START] {nodeId: "...", ...}
✅ [INTERNAL_ROW_MANAGER][AUTO_APPEND] Adding new row
🚀 [INTERNAL_ROW_MANAGER] Started continuousBuilding
🔓 [INTERNAL_ROW_MANAGER][ADD_ROW][END] {newRowId: "...", ...}
```

### Log di Isolamento:
```
🔒 [INTERNAL_ROW_MANAGER] Skip sync: internal operation in progress
🔄 [INTERNAL_ROW_MANAGER] Syncing from external update
```

### Log di Disattivazione:
```
🛑 [INTERNAL_ROW_MANAGER] Stopped continuousBuilding
```

---

## ⚠️ Step 5: Se Qualcosa Va Storto

### Rollback Immediato
1. Apri la **Console del browser**
2. Esegui:
```javascript
localStorage.removeItem('feature.internalRowManager');
```
3. **Ricarica la pagina**
4. Il vecchio codice riprenderà automaticamente

### Verifica Comportamento Vecchio
- Dopo il rollback, verifica che il comportamento torni a quello precedente
- Non dovresti vedere più i log `[INTERNAL_ROW_MANAGER]`

---

## 📊 Checklist Test

- [ ] Feature flag abilitato
- [ ] Log `[INTERNAL_ROW_MANAGER]` visibili nella console
- [ ] Auto-append funziona al primo Enter
- [ ] Auto-append continua per righe successive
- [ ] Focus va sulla nuova riga dopo auto-append
- [ ] Click sul canvas disattiva `continuousBuilding`
- [ ] Click su riga esistente disattiva `continuousBuilding`
- [ ] Click su ultima riga vuota riattiva `continuousBuilding`
- [ ] Rollback funziona correttamente

---

## 🐛 Troubleshooting

### Problema: Non vedo i log `[INTERNAL_ROW_MANAGER]`
- **Soluzione**: Verifica che il feature flag sia settato correttamente
- Controlla in Console: `localStorage.getItem('feature.internalRowManager')` → deve essere `"true"`

### Problema: Auto-append non funziona
- **Soluzione**: Controlla i log per vedere se `continuousBuilding` si attiva
- Verifica che la riga sia effettivamente l'ultima e vuota prima di premere Enter

### Problema: Focus non va sulla nuova riga
- **Soluzione**: Controlla i log per vedere se `newRowId` viene generato
- Verifica che `editingRowId` sia settato correttamente

### Problema: Oscillazioni o comportamenti strani
- **Soluzione**: Disabilita il feature flag e riabilitalo
- Controlla i log per vedere se ci sono chiamate multiple a `addRow`

---

## ✅ Cosa Significa Successo

Se tutti i test passano:
- ✅ Il nuovo hook funziona correttamente
- ✅ L'isolamento è efficace
- ✅ `continuousBuilding` si gestisce correttamente
- ✅ Auto-append è deterministica e affidabile

Puoi procedere con il rollout completo rimuovendo il feature flag e rendendo il nuovo hook il default!

