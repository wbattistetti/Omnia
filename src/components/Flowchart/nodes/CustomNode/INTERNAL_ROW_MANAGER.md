# Internal Row Manager - Feature Flag Guide

## 🎯 Overview

Il nuovo hook `useInternalRowManager` gestisce tutte le operazioni sulle righe in modo completamente isolato, con:
- ✅ Metodo `addRow()` incapsulato
- ✅ Stato `continuousBuilding` interno
- ✅ Isolamento completo da eventi esterni
- ✅ Zero interferenze con sincronizzazione esterna

## 🚀 Come abilitare

### Abilitazione temporanea (solo per test)
```javascript
// Apri la console del browser e esegui:
localStorage.setItem('feature.internalRowManager', 'true');
// Ricarica la pagina
```

### Disabilitazione (rollback immediato)
```javascript
// Apri la console del browser e esegui:
localStorage.removeItem('feature.internalRowManager');
// Ricarica la pagina
```

## 🔍 Come funziona

### Continuous Building
- Si attiva automaticamente quando:
  - Il nodo è vuoto e inizi a editare
  - Edit l'ultima riga vuota di un nodo
- Si disattiva quando:
  - Clicchi sul canvas
  - Clicchi su una riga esistente con testo
  - Esci dall'editing (ESC o click esterno)

### Isolamento
- `isInternalOperationRef` blocca la sincronizzazione esterna durante operazioni interne
- Le operazioni sono atomiche (tutto in un batch)
- Il parent viene notificato UNA VOLTA alla fine

### Auto-append
- Funziona solo se `continuousBuilding` è attivo
- Aggiunge una nuova riga vuota quando:
  - Stai editando l'ultima riga
  - La riga era vuota e ora è piena
  - Premendo Enter

## 🧪 Testing

1. **Abilita il feature flag** (vedi sopra)
2. **Crea un nuovo nodo** (dovrebbe essere vuoto)
3. **Inizia a scrivere** - dovrebbe attivarsi `continuousBuilding`
4. **Premi Enter** - dovrebbe auto-appendare una nuova riga
5. **Continua a scrivere** - dovrebbe continuare ad auto-appendare
6. **Clicca sul canvas** - dovrebbe disattivare `continuousBuilding`
7. **Verifica i log** - cerca `[INTERNAL_ROW_MANAGER]` nella console

## 📊 Debugging

I log mostrano:
- `🔒 [INTERNAL_ROW_MANAGER][ADD_ROW][START]` - Inizio operazione
- `✅ [INTERNAL_ROW_MANAGER][AUTO_APPEND]` - Auto-append eseguito
- `🚀 [INTERNAL_ROW_MANAGER] Started continuousBuilding` - Building attivato
- `🛑 [INTERNAL_ROW_MANAGER] Stopped continuousBuilding` - Building disattivato
- `🔓 [INTERNAL_ROW_MANAGER][ADD_ROW][END]` - Fine operazione
- `🔄 [INTERNAL_ROW_MANAGER] Syncing from external update` - Sincronizzazione esterna
- `🔒 [INTERNAL_ROW_MANAGER] Skip sync: internal operation` - Sincronizzazione bloccata

## ⚠️ Note

- Il vecchio hook `useNodeRowManagement` rimane intatto come fallback
- Se qualcosa va storto, disabilita il flag e riparti dal vecchio codice
- La feature è completamente isolata e non tocca il codice esistente

