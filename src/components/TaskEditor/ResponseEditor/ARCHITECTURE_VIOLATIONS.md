# ⚠️ Architecture Violations - Da Rivedere

**Ultimo aggiornamento**: 2024
**Status**: Violazioni note da risolvere

---

## Violazioni Trovate

### 1. `node-editing` → `persistence`

**File**: `features/node-editing/core/applyNodeUpdate.ts`
**Linea**: 7
**Import**: `import { saveTaskToRepository } from '@responseEditor/features/persistence/ResponseEditorPersistence';`

**Problema**: La feature `node-editing` importa da `persistence`, violando la regola che le feature non devono importare tra loro.

**Opzioni di Risoluzione**:

#### Opzione A: Spostare `persistence` in `core/`
Se `persistence` è un servizio condiviso, potrebbe essere spostato in `core/persistence/`:
```
core/
  ├── domain/
  ├── state/
  └── persistence/  # ← Nuovo
```

**Pro**: Persistence diventa parte del core, accessibile a tutte le feature
**Contro**: Richiede refactoring

#### Opzione B: Usare dependency injection
Iniettare `saveTaskToRepository` come parametro invece di importarlo direttamente.

**Pro**: Mantiene le feature isolate
**Contro**: Aumenta la complessità delle signature

#### Opzione C: Creare un servizio condiviso
Spostare `saveTaskToRepository` in un servizio condiviso (es. `@services/`).

**Pro**: Mantiene le feature isolate
**Contro**: Potrebbe non essere appropriato se è specifico per ResponseEditor

**Raccomandazione**: Valutare se `persistence` è davvero una feature o dovrebbe essere parte del core.

---

## Processo di Risoluzione

1. **Architecture Owner review**: Valutare quale opzione è migliore
2. **Creare issue**: Documentare la decisione
3. **Implementare fix**: Applicare la soluzione scelta
4. **Verificare**: Eseguire `npm run verify:features` per confermare

---

## Note

- Queste violazioni sono **note** e **documentate**
- Non bloccano lo sviluppo, ma dovrebbero essere risolte
- L'Architecture Owner deve decidere la strategia di risoluzione

---

**Prossima revisione**: Quando Architecture Owner è designato
