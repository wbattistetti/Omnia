# Semantica: GrammarFlow (policy G2)

Documento **normativo** per il motore GrammarFlow (IDE + runtime VB). Complementa `docs/SEMANTICA_TASK_VARIABLES_E_SUBFLOW.md` sul piano **NLP / estrazione**.

---

## Invarianti

1. **Slot semantico (`SemanticSlot`)** ha un **id proprio** (`SemanticSlot.id` / grammar slot id). **Non** è l’id del nodo nel task tree (`TaskTreeNode`), **non** è l’id di un nodo nel grafo grammaticale salvo coincidenza esplicita e non garantita.
2. **Mapping obbligatorio:** `grammarSlot.id` → `flowVariable.id` tramite `slotBindings[]` (`grammarSlotId`, `flowVariableId`). Il `flowVariableId` coincide con **`taskId`** / variabile di flow del dato (stessa semantica di §1–2 in `SEMANTICA_TASK_VARIABLES_E_SUBFLOW.md`).
3. **Nessuna identità implicita** `grammarSlot.id === TaskTreeNode.id` nel modello di verità; eventuali uguaglianze accidentali nei dati non vanno usate come regola.

---

## Runtime (VB)

- **Estrazione regex:** le chiavi in `ParseResult.Bindings` per i **slot** usano l’**id dello slot** (grammar slot id), non il nome visualizzato dello slot.
- **Compilazione NLP:** `NlpContractCompiler` valida che ogni slot dichiarato abbia `slotBindings` e che ogni `flowVariableId` compaia in `SubDataMapping`.
- **`POST /api/nlp/grammarflow-extract`:** per ogni riga `SubDataMapping`, si risolve prima tramite **G2** (`slotBindings` → chiave in `bindings` = grammar slot id). Poi, se presente, **`GroupName`** (es. gruppo regex `s1`) allineato alla chiave nel dizionario `bindings`.

---

## Note su semantic set e chiavi non-slot

- I nodi **solo semantic-set** possono valorizzare `bindings` con la chiave **nome del semantic set** (non grammar slot id). Per allineare a `SubDataMapping` senza slot dedicato, usare **`GroupName`** nel mapping coerente con quella chiave, oppure modellare un **slot** + `slotBindings` verso il `flowVariableId` atteso.

---

## Riferimenti codice

- TS: `grammarFlowInitialSlots.ts`, `grammarFlowContractHelpers.ts`, `Grammar` in `grammarTypes.ts`.
- VB: `Grammar.vb`, `GrammarSlotBinding.vb`, `NlpContractCompiler.vb`, `CompiledGrammarFlowEngine.vb`, `GrammarFlowExtractHandlers.vb`.
