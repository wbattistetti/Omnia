# Contratto UI ↔ dominio (grafo flow)

Obiettivo della migrazione incrementale: **una sola catena di scrittura strutturale** verso il workspace (`FlowStore`), senza aggiornamenti paralleli da React Flow locale, merge ottimistico incorrelato o sync post-commit che riscrivono `node.data.rows`.

## Fonte di verità

| Layer | Ruolo dopo la migrazione |
|-------|---------------------------|
| **FlowStore / slice** | Unica copia canonica di nodi, righe (`data.rows`), edge |
| **StructuralOrchestrator** (`runStructuralCommandSync`) | Unico punto che applica mutazioni dominio + pipeline subflow/reverse |
| **React Flow** | Viewer: props `nodes`/`edges` derivati dallo store |
| **DnD** | Produce **comandi** (`DragRowPayload` / eventi aggregati); non aggiorna il grafo direttamente |

## Tipi ed entry point

- `DragRowPayload` — `src/domain/flowGraph/dndRowPayloadTypes.ts`
- `buildCrossNodeRowMoveDetail` — builder unico del detail `crossNodeRowMove`
- Warning DEV — `warnLocalGraphMutation` (`[FlowGraph:migration]`)

## Flag ambiente (fasi 4+)

Impostare in `.env.local` (`1` = attivo):

| Variabile | Effetto |
|-----------|---------|
| `VITE_FLOW_GRAPH_SILENCE_LOCAL_WARNINGS=1` | Sopprime i warning Phase 1 (`[FlowGraph:migration]`) |
| `VITE_FLOW_GRAPH_DISABLE_OPTIMISTIC_MERGE` | Non fa merge ottimistico su target in `CustomNode` dopo drop |
| `VITE_FLOW_GRAPH_DISABLE_SCHEDULE_COMMITTED_SYNC` | Orchestratore non schedula `scheduleCommittedFlowNodeRowsSync` |
| `VITE_FLOW_GRAPH_DISABLE_COMMITTED_ROWS_LISTENER` | `FlowCanvasHost` ignora evento righe committed |
| `VITE_FLOW_GRAPH_DISABLE_EXTERNAL_ROW_DERIVE` | Riservato — disabilita derive locale (solo dopo RF viewer-only) |

## Test manuali dopo ogni forbice

Main↔main, main↔subflow, subflow→main, canvas↔nodo, multi-tab, picker variabili (`utteranceGuidSet` vs store), assenza duplicati `rowId` tra slice.
