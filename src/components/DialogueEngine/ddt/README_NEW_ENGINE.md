# DDT Engine - Nuova Implementazione Parallela

## 📋 Panoramica

Questa è un'implementazione **parallela** della nuova logica DDT Engine che **NON modifica** il codice esistente. È completamente sicura da testare perché:

- ✅ **Nessun file esistente è stato modificato**
- ✅ **Il vecchio codice continua a funzionare**
- ✅ **Possiamo testare la nuova logica in parallelo**
- ✅ **Possiamo fare switch graduale con feature flag**

## 🏗️ Architettura

La nuova implementazione segue la logica proposta:

```
RunDDT (orchestratore principale)
  ↓
GetNextData (trova prossimo dato vuoto)
  ↓
GetResponse (selettore step/escalation)
  ↓
PlayResponse (esegue messaggio + produce TurnEvent)
  ↓
GetState (gestisce transizione stato)
  ↓
repeat until turnState == null
```

## 📁 File Creati

### 1. `ddtEngineTypes.ts`
Definisce tutti i types TypeScript per la nuova implementazione:
- `TurnState`, `TurnEvent`, `Context`
- `TurnStateDescriptor`, `Response`, `CurrentData`
- `DDTEngineState`, `Counters`, `Limits`

### 2. `ddtEngine.ts`
Implementazione principale con tutte le funzioni:
- `runDDT()` - Funzione principale orchestratore
- `GetNextData()` - Trova prossimo dato vuoto
- `GetResponse()` - Selettore step/escalation
- `PlayResponse()` - Esegue messaggio + produce TurnEvent
- `GetState()` - Gestisce transizioni di stato
- Helper functions

### 3. `ddtEngineAdapter.ts`
Adapter per compatibilità con vecchio codice:
- `executeGetDataWithNewEngine()` - Wrapper con vecchia interfaccia
- `executeGetDataHybrid()` - Sceglie tra vecchio e nuovo engine con feature flag

## 🚀 Come Usare

### Opzione 1: Test Diretto (Raccomandato per Testing)

```typescript
import { runDDT } from './ddt/ddtEngine';
import type { DDTEngineCallbacks } from './ddt/ddtEngineTypes';

const result = await runDDT(ddtInstance, callbacks, {
  noMatchMax: 3,
  noInputMax: 3,
  notConfirmedMax: 2
});
```

### Opzione 2: Usa Adapter con Feature Flag

```typescript
import { executeGetDataHybrid, USE_NEW_DDT_ENGINE } from './ddt/ddtEngineAdapter';

// Abilita nuovo engine
USE_NEW_DDT_ENGINE = true;

const result = await executeGetDataHybrid(ddt, state, callbacks);
```

### Opzione 3: Sostituzione Graduale

1. **Fase 1**: Testa nuovo engine in ambiente di sviluppo
   ```typescript
   // In taskExecutors.ts (NON modificare, solo testare)
   import { runDDT } from './ddt/ddtEngine';
   // ... test parallelo
   ```

2. **Fase 2**: Abilita con feature flag su subset utenti
   ```typescript
   USE_NEW_DDT_ENGINE = process.env.ENABLE_NEW_ENGINE === 'true';
   ```

3. **Fase 3**: Monitora errori e performance

4. **Fase 4**: Se tutto ok, sostituisci completamente

## 🔍 Testing Comparativo

Per testare che la nuova implementazione produca gli stessi risultati:

```typescript
// Test comparativo
const oldResult = await executeGetDataHierarchical(ddt, state, callbacks);
const newResult = await runDDT(ddt, callbacks);

// Confronta risultati
expect(newResult.success).toBe(oldResult.success);
expect(newResult.value).toEqual(oldResult.value);
```

## 📊 Statistiche

- **Codice nuovo**: ~560-690 righe (vs ~3120 attuali)
- **Riduzione**: ~78-82%
- **File**: 1 file principale + types + adapter
- **Complessità**: Molto più bassa (switch invece di if/else annidati)

## ⚠️ Note Importanti

1. **NON modificare** i file esistenti finché non hai testato completamente
2. **Usa feature flag** per switch graduale
3. **Monitora** errori e performance dopo switch
4. **Mantieni** vecchio codice finché nuovo non è validato

## 🔄 Prossimi Passi

1. ✅ Implementazione parallela completata
2. ⏳ Scrivere test comparativi
3. ⏳ Testare in ambiente di sviluppo
4. ⏳ Abilitare con feature flag
5. ⏳ Monitorare e validare
6. ⏳ Sostituire completamente (solo dopo validazione)

## 📝 Esempio Completo

```typescript
import { runDDT } from './ddt/ddtEngine';
import type { DDTEngineCallbacks } from './ddt/ddtEngineTypes';

const callbacks: DDTEngineCallbacks = {
  onMessage: (text, stepType, escalationLevel) => {
    console.log('Message:', text);
  },
  onGetRetrieveEvent: async (nodeId) => {
    // Wait for user input
    const input = await getUserInput();
    return { type: 'match', value: input };
  },
  onProcessInput: async (input, node) => {
    // Process through contract
    return { status: 'match', value: input };
  },
  translations: {}
};

const result = await runDDT(ddtInstance, callbacks);
```

## 🎯 Vantaggi della Nuova Implementazione

1. **Separazione responsabilità**: Ogni funzione ha un ruolo chiaro
2. **Ciclo deterministico**: repeat-until esplicito
3. **Switch centralizzati**: Più facile da seguire
4. **Testabilità**: Funzioni pure, più facile da testare
5. **Manutenibilità**: Logica centralizzata in 1 file

