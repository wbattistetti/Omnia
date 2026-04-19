# Checklist di verifica — writer legacy (binaria, automatizzabile)

Eseguire dalla root del repo. **PASS** = exit 0 e zero match (o match attesi). **FAIL** = match non attesi o exit ≠ 0.

Usare anche: `npx vitest run` sui test elencati.

---

## 1. Nessun `commitRowsToParent` (rinominato)

| ID | Comando | Aspettativa |
|----|---------|-------------|
| 1.1 | `rg "commitRowsToParent" src --glob "*.{ts,tsx}"` | 0 risultati |

---

## 2. Nessun `normalizedData.onUpdate` / flusso righe verso parent

| ID | Comando | Aspettativa |
|----|---------|-------------|
| 2.1 | `rg "normalizedData\.onUpdate" src/components/Flowchart --glob "*.{ts,tsx}"` | 0 risultati |

---

## 3. Nessun `data.onUpdate` su canvas CustomNode/TaskNode (eccezione documentata edge)

| ID | Comando | Aspettativa |
|----|---------|-------------|
| 3.1 | `rg "data\.onUpdate" src/components/Flowchart/nodes/CustomNode --glob "*.{ts,tsx}"` | 0 risultati |
| 3.2 | `rg "data\?\.onUpdate" src/components/Flowchart/nodes/TaskNode --glob "*.{ts,tsx}"` | 0 risultati |
| 3.3 | `rg "data\.onUpdate" src/components/Flowchart/edges/CustomEdge.tsx` | **Nota:** finché CustomEdge non migrato, può essere >0 — **FAIL intenzionale fino a migrazione** |

---

## 4. Nessun opt-out `VITE_FLOW_VIEWER_ONLY_ROWS` nel codice funzionale

| ID | Comando | Aspettativa |
|----|---------|-------------|
| 4.1 | `rg "VITE_FLOW_VIEWER_ONLY_ROWS" src/domain/flowStateMachine/flowMachineConfig.ts` | Solo commento che indica “sempre attivo” oppure assente dal branch logico |

---

## 5. `deriveSyncedNodeRows` assente

| ID | Comando | Aspettativa |
|----|---------|-------------|
| 5.1 | `rg "deriveSyncedNodeRows" src` | 0 risultati |

---

## 6. `useInternalRowManager` eliminato

| ID | Comando | Aspettativa |
|----|---------|-------------|
| 6.1 | `rg "useInternalRowManager" src` | 0 risultati |

---

## 7. Dock — policy importata e testata

| ID | Verifica | PASS se |
|----|----------|---------|
| 7.1 | `npx vitest run src/components/AppContent/__tests__/dockInboundFlowSlicePolicy.test.ts` | tutti green |

---

## 8. Domain task subflow (non regressione)

| ID | Comando | PASS se |
|----|---------|---------|
| 8.1 | `npx vitest run src/domain/taskSubflowMove --reporter=dot` | tutti green |

---

## 9. Flow load / merge policy

| ID | Comando | PASS se |
|----|---------|---------|
| 9.1 | `npx vitest run src/flows/__tests__/flowLoadMergePolicy.test.ts 2>$null` | file esiste ed esito green (se il file non esiste, segnare N/A) |

---

## 10. projectId — pattern critici (smoke)

| ID | Comando | PASS se |
|----|---------|---------|
| 10.1 | `rg "projectData\?\.id \|\|" src/components/Flowchart/nodes/CustomNode/CustomNode.tsx` senza `resolveVariableStoreProjectId` nello stesso file | Non applicabile come singola riga: verifica manuale — `applyCanvasRowExtractStructural` deve usare `resolveVariableStoreProjectId` |

---

## Script automatico (repository)

```bash
npm run verify:legacy-writers
```

Implementazione: `scripts/verify-legacy-writers.js` (richiede `rg` / ripgrep sul PATH).

---

## Interpretazione “writer paralleli”

- **PASS:** nessun commit righe tramite `onUpdate`/`normalizedData.onUpdate`; un solo aggiornamento grafo slice via macchina/workspace per quel flusso.
- **Eccezione nota:** **CustomEdge** fino a refactoring dedicato.

---

## Fase 4 — Esecuzione (report)

| ID | Verifica | Esito |
|----|----------|--------|
| `verify-legacy-writers` | `npm run verify:legacy-writers` | **PASS** |
| Test domain | `vitest run` suite dock + taskSubflowMove + flowchartRowTextDisplay + nodeRowExternalSync | **PASS** (102 test inclusi nel batch eseguito) |
| CustomEdge `data.onUpdate` | Pattern ancora presenti | **FAIL atteso / debito** — migrazione edge futura |
| S2 idempotenza dedicata | Nessuna modifica extra nel dominio | **N/A** (fuori scope richiesta “solo restore/rename”) |

### File ancora da affrontare per “zero eccezioni”

- `src/components/Flowchart/edges/CustomEdge.tsx` — rimuovere `FlowStateBridge.getCreateOnUpdate` / inject `onUpdate` su edge data.
