# 🔍 Come Verificare che Stai Usando il Nuovo Hook

## ✅ Indicatori Visivi

### 1. Badge "NEW" Verde
- **Dove**: In alto a destra dell'header del nodo
- **Quando**: Sempre visibile se il nuovo hook è attivo
- **Aspetto**: Badge verde con scritto "NEW"

### 2. Badge "BUILDING" Blu (con animazione)
- **Dove**: Accanto al badge "NEW" (a sinistra)
- **Quando**: Visibile solo quando `continuousBuilding` è attivo
- **Aspetto**: Badge blu che pulsa con scritto "BUILDING"

## 📊 Log nella Console

### Log Iniziali (quando il nodo viene montato)
```
🆕 [CUSTOM_NODE] Using NEW Internal Row Manager
🆕 [INTERNAL_ROW_MANAGER][MOUNT] New hook initialized
```

### Log durante le Operazioni
```
🔒 [INTERNAL_ROW_MANAGER][ADD_ROW][START] ⚡ NUOVO HOOK
✅ [INTERNAL_ROW_MANAGER][AUTO_APPEND] Adding new row
🚀 [INTERNAL_ROW_MANAGER] Started continuousBuilding
🛑 [INTERNAL_ROW_MANAGER] Stopped continuousBuilding
```

## 🧪 Test Rapido

1. **Abilita il feature flag**:
```javascript
localStorage.setItem('feature.internalRowManager', 'true');
location.reload();
```

2. **Crea un nuovo nodo**
   - Dovresti vedere il badge **"NEW"** verde in alto a destra

3. **Inizia a scrivere nella prima riga**
   - Il badge **"BUILDING"** blu dovrebbe apparire (e pulsare)

4. **Controlla la console**
   - Dovresti vedere log con `[INTERNAL_ROW_MANAGER]` o `⚡ NUOVO HOOK`

## ⚠️ Se NON Vedi i Badge

### Verifica che il Feature Flag sia Attivo
```javascript
// Nella console del browser:
localStorage.getItem('feature.internalRowManager')
// Deve restituire: "true"
```

### Se è "null" o "false"
```javascript
// Abilitalo:
localStorage.setItem('feature.internalRowManager', 'true');
location.reload();
```

## 🔄 Confronto Vecchio vs Nuovo

### Vecchio Hook (useNodeRowManagement)
- ❌ Nessun badge visibile
- ❌ Log normali senza `[INTERNAL_ROW_MANAGER]`
- ❌ Nessun badge "BUILDING"

### Nuovo Hook (useInternalRowManager)
- ✅ Badge "NEW" verde sempre visibile
- ✅ Badge "BUILDING" blu quando attivo
- ✅ Log con `[INTERNAL_ROW_MANAGER]` o `⚡ NUOVO HOOK`

## 🐛 Problemi Comuni

### "Non vedo il badge NEW"
- **Causa**: Feature flag non attivo
- **Soluzione**: Abilita il flag e ricarica

### "Vedo NEW ma non BUILDING"
- **Causa**: `continuousBuilding` non è ancora attivo
- **Soluzione**: Inizia a scrivere nella prima riga vuota

### "I log non compaiono"
- **Causa**: Console filtrata o feature flag non attivo
- **Soluzione**: Verifica i filtri della console e il feature flag

