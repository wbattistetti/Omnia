# Piano di rimozione writer legacy (Flow workspace / canvas)

Obiettivo: una sola catena di scrittura verso `FlowStore` tramite eventi workspace (`APPLY_WORKSPACE_MACHINE_EVENT`, `COMMIT_WORKSPACE_SNAPSHOT`, `updateFlowGraph`/`structuralCommand`), senza fallback `data.onUpdate` / `normalizedData.onUpdate` per **righe nodo** e senza flag che riabilitano derive legacy.

**Nota architetturale (importante):** in produzione `FlowCanvasHost` passa a `FlowEditor` dei `setNodes`/`setEdges` che **già** wrappano `updateFlowGraph` → non sono “shadow state” React Flow separato dallo store. Chiunque chiami quel `setNodes` scrive **nello slice** del flusso. Il requisito “viewer-only” significa: nessuna seconda verità (props `onUpdate` verso il parent grafo); **non** significa “zero chiamate a `setNodes` nel tree”, altrimenti React Flow non funziona.

---

## A. Writer **autorizzati** (mantenere, documentare)

| Percorso | File / area | Ruolo |
|----------|-------------|--------|
| `updateFlowGraph` | `FlowCanvasHost.tsx` → `setNodes`/`setEdges` passati a `FlowEditor` | Unico setter RF collegato allo store per il canvas principale |
| `APPLY_WORKSPACE_MACHINE_EVENT` | `FlowStore.tsx` → `applyWorkspaceMachineEvent` | Upsert, meta, graph update, load result |
| `COMMIT_WORKSPACE_SNAPSHOT` | `FlowStore.tsx`, `commitStructuralWorkspaceMachineEvent` | Commit atomico dopo pipeline strutturale |
| `structuralCommand` | `CustomNode` (DnD canvas), `useCrossFlowRowMoveOrchestrator` | Spostamenti strutturali |

---

## B. Writer legacy / da eliminare o instradare (file e funzione)

### `src/components/Flowchart/nodes/CustomNode/hooks/useNodeRowManagement.ts`

| Elemento | Azione |
|----------|--------|
| `commitRowsToParent` | **Rinominare** in `commitRowsToWorkspace` e **rimuovere** ramo `normalizedData.onUpdate` |
| Ramo `!isViewerOnlyStoreAlignedRowsEnabled()` + pending id refs | **Rimuovere** (flag reso sempre attivo; ref opzionalmente semplificate) |
| `warnLocalGraphMutation` per commit verso parent | **Rimuovere** (non più percorso parent) |
| `handleDeleteRow` → `normalizedData.onDelete?.()` | **Instradare** su `useFlowActionsStrict().deleteNode(nodeId)` quando nodo temporaneo vuoto |

### `src/domain/flowStateMachine/flowMachineConfig.ts`

| Elemento | Azione |
|----------|--------|
| `isViewerOnlyStoreAlignedRowsEnabled` lettura `VITE_FLOW_VIEWER_ONLY_ROWS` | **Convertire** in sempre `true` (**eliminare** opt-out legacy) |

### `src/utils/flowchartRowTextDisplay.ts`

| Elemento | Azione |
|----------|--------|
| Branch condizionale su `isViewerOnlyStoreAlignedRowsEnabled()` | **Semplificare** (funzione sempre true → logica unica) |

### `src/components/Flowchart/nodes/CustomNode/hooks/useNodeEventHandlers.ts`

| Elemento | Azione |
|----------|--------|
| `handleTitleUpdate` fallback `data.onUpdate` | **Eliminare** → `useFlowActionsStrict().updateNode` |
| `handleDeleteNode` fallback `data.onDelete` | **Eliminare** → `useFlowActionsStrict().deleteNode` |

### `src/components/Flowchart/nodes/CustomNode/CustomNode.tsx`

| Elemento | Azione |
|----------|--------|
| `handleToggleUnchecked` / `NodeHeader` `onToggleHideUnchecked` → `data.onUpdate` | **Eliminare** fallback; usare solo `flowActions.updateNode` (**strict** consigliato) |
| `useFlowActions()` nullable + `?.` | **Valutare** `useFlowActionsStrict` dove applicabile |

### `src/components/Flowchart/nodes/TaskNode/TaskNode.tsx`

| Elemento | Azione |
|----------|--------|
| `data.onUpdate` in `commit` / `cancel` | **Eliminare**; usare `useFlowActionsStrict()` |

### `src/components/Flowchart/edges/CustomEdge.tsx`

| Elemento | Azione |
|----------|--------|
| `props.data.onUpdate`, `FlowStateBridge.getCreateOnUpdate`, `setEdges` per injettare `onUpdate` | **DEBITO RESIDUO**: non integrato in questa passata; richiede modello edge unico via `updateEdge` / store (vedi sezione rischi) |

### `src/components/Flowchart/nodes/CustomNode/hooks/useInternalRowManager.ts` + `INTERNAL_ROW_MANAGER.md`

| Elemento | Azione |
|----------|--------|
| Intero modulo | **Eliminare** (nessun import in produzione — codice morto) |

### `src/context/FlowActionsContext.tsx`

| Elemento | Azione |
|----------|--------|
| JSDoc che suggerisce fallback `data.onUpdate` | **Aggiornare** alla policy senza fallback |

---

## C. Dock / slice vuoti / contenuto non strutturale

| File | Punto | Stato / azione |
|------|--------|------------------|
| `AppContent.tsx` (`DockManagerWithFlows`) | `mergeDockInboundLayoutOnly` + `shouldSkipDockInboundBareEmptySlice` | Già direzione “layout-only”; mantenere e **verificare** ogni nuovo upsert dock |
| `dockInboundFlowSlicePolicy.ts` | Skip empty / `emptyNodesExplicit` | Policy esplicita; **test** in `dockInboundFlowSlicePolicy.test.ts` |
| `workspaceTransitions.ts` `reduceUpsertFlow` | Preserva nodi subflow su upsert vuoto | Salvaguardia contenuto; non è “Dock riscrive translations” se merge è locale |

---

## D. loadFlow / hydration vs snapshot strutturali

| File | Punto | Rischio | Mitigazione già presente |
|------|--------|---------|---------------------------|
| `flowHydrationPolicy.ts` | `hydrated_empty_after_server_apply` | Stop refetch loop su vuoto confermato | OK per stabilità |
| `workspaceTransitions.ts` `reduceApplyFlowLoadResult` | Server vuoto vs locale | `shouldKeepLocalGraphOnEmptyServerResponse`, merge meta | Verificare `hasLocalChanges` dopo commit strutturale |
| `FlowCanvasHost.tsx` | Effect dipende da `nodeCount` | Re-fetch dopo edit locale | Policy `local_nonempty_skip_server_fetch` |

---

## E. projectId undefined → commit strutturale bloccato

| File | Punto |
|------|--------|
| `CustomNode.tsx` `applyCanvasRowExtractStructural` | `resolveVariableStoreProjectId(explicit \|\| undefined)` |
| `FlowEditor.tsx` | `structuralProjectId` risolto |
| `FlowCanvasHost.tsx` | `resolveVariableStoreProjectId`; guard su prop `projectId` vuoto per load server |
| `useCrossFlowRowMoveOrchestrator.ts` | Verificare `projectId` passato dall’editor |

---

## F. Pipeline S2 (restore / rename) oscillazione

| Area | File indicativi | Nota |
|------|-----------------|------|
| Applicazione spostamento | `applyTaskMoveToSubflow.ts`, `autoRenameParentVariables.ts`, `subflowVariableProxyRestore.ts` | Unica eccezione “dominio” consentita: **idempotenza** restore/rename (passate future) |

---

## G. Canvas “viewer-only 100%” — realismo

- **Row data:** solo store via `commitNodeRowsToWorkspace` → `updateFlowGraph` (**completato** rimuovendo `onUpdate`).
- **Posizione nodi / drag / resize / RF internals:** continuano a usare `setNodes`/`setEdges` **purché** siano quelli da `FlowCanvasHost` (= store). **Non** sono writer paralleli.
- **CustomEdge `onUpdate` legacy:** eccezione nota fino a migrazione edge dedicata.

---

## H. Ordine di intervento (consigliato)

1. Eliminare codice morto (`useInternalRowManager`).
2. Forzare viewer-only config; semplificare `flowchartRowTextDisplay`.
3. `useNodeRowManagement`: un solo commit store; rinomina; rimuovi onUpdate righe.
4. `useNodeEventHandlers`, `TaskNode`, `CustomNode`: `useFlowActionsStrict`, rimuovi fallback `onUpdate`/`onDelete`.
5. Aggiornare documentazione contesto / script di verifica.
6. (Futuro) `CustomEdge`: sostituire bridge `FlowStateBridge.getCreateOnUpdate` con aggiornamenti edge via contesto/store.

---

## I. Rischi e dipendenze

- **CustomEdge:** senza migrazione, resta un percorso `onUpdate` sugli edge; va trattato come **fase 2** dello stesso programma.
- **Test Vitest** che mockano `isViewerOnlyStoreAlignedRowsEnabled: () => false`: vanno **aggiornati** quando la funzione è sempre true.
- **Story / mount isolato** di nodi senza `FlowActionsProvider`: oggi l’app reale usa sempre il provider; mount di test deve wrappare il provider o usare mock strict.

---

## J. Dipendenze incrociate

- `useNodeRowManagement` ← solo `CustomNode` (commit obbligatorio).
- `FlowActionsContext` ← `FlowCanvasHost` + `FlowEditor` tree.

---

*Generato come Fase 1 obbligatoria; ultima revisione coerente con snapshot repository al momento dell’implementazione.*
