# Semantica architetturale: task, variabili, GUID e spostamento verso sottoflusso

Documento **normativo** per Omnia: definisce il modello concettuale vincolante e il comportamento operativo atteso.  
Il codice esistente che non rispetta questi punti va trattato come **debito tecnico da allineare**, non come definizione alternativa del modello.

---

## 1. Semantica task-based (invarianti)

1. Ogni `TaskTreeNode` rappresenta un **task reale** nel modello, non un semplice pezzo di UI.
2. Ogni nodo ha un proprio **`taskId`**. Se `taskId` non è valorizzato, è **bug o incompletezza**, non una variante valida.
3. Ogni task raccoglie un **singolo valore atomico**.
4. Ogni valore ha una **variabile dedicata**.
5. **Regola di identità:** `VariableInstance.varId` = `node.taskId` (il GUID della variabile coincide con l’identità del task del nodo / del dato).
6. **`nodeId`** identifica il nodo nell’albero strutturale; la **chiave semantica** per il valore runtime è **`varId` = `taskId`**.
7. Non usare la semantica legacy **«un solo task canvas con subcampi logici»** come modello di riferimento.
8. L’albero è **composizione di task**; ogni nodo = un micro-comportamento che raccoglie un valore.

---

## 2. Variabili, dati e GUID

9. Quando un task vive in un flow, per **ogni dato** del task (e dei suoi subtask/nodi) esiste una variabile nel flow che memorizza il valore.
10. **Allineamento GUID:** il dato ha un GUID; la variabile che lo rappresenta usa lo **stesso GUID** (`varId` = `dataId` = `taskId` del nodo corrispondente).
11. Ogni dato di ogni task nella gerarchia deve avere una variabile che ne memorizza il valore **nel flow in cui quel task vive**.

---

## 3. Variabili referenziate in un flow (vincolo operativo)

Per applicare correttamente la logica di spostamento task → sottoflusso occorre calcolare con precisione **`variabiliReferenziate`**: insieme dei `varId` effettivamente usati nel flow.

### Punti di scansione (non esaustivo: estendere se il prodotto aggiunge canali)

- Condizioni (if, switch, expression evaluator / DSL).
- Script (JS/TS o motore espressioni).
- Messaggi (interpolazioni `{{var}}`, placeholder, bracket tokens).
- Parametri di chiamate API.
- Input/output di sottoflusso e mapping interfaccia.
- Azioni (set variable, append, transform, ecc.).
- Validazioni.
- Transizioni condizionali.
- Qualsiasi nodo o campo che accetti espressioni o template.

### Metodo

- Analisi statica del grafo/JSON del flow (o struttura equivalente).
- Parsing delle stringhe dove necessario per estrarre riferimenti a `varId` / GUID.
- Risultato:
  - **`variabiliReferenziate`** = insieme dei `varId` trovati.
  - Le altre variabili del flow (nel contesto considerato) = non referenziate ai fini di quella scansione.

---

## 4. Comportamento: spostare un task nel sottoflusso

Contesto: flow parent (es. MAIN), sottoflusso creato, si sposta un intero task (con eventuali subtask/nodi) dal parent al sottoflusso.

### A) Sottoflusso

12. Per ogni dato del task e per ogni dato dei suoi subtask/nodi, creare le **variabili corrispondenti nel sottoflusso**.
13. Le variabili nel sottoflusso **mantengono gli stessi GUID** (`varId` invariati). Stesso dato, stesso task logico; cambia solo il flow.
14. È valido e desiderabile che la **label** nel sottoflusso coincida con la precedente (es. `nome`): spazi di nomi distinti (flow diversi).

### B) Flow parent (policy **S2** — mapping esplicito)

15. Dopo lo spostamento, le variabili legate a quel task nel parent sono potenzialmente **orfane** rispetto al task, ma possono essere ancora **referenziate** ovunque nel parent (condizioni, messaggi, ecc.) oppure **no**.
16. Se una variabile nel parent **non** è referenziata da nessuna parte → può essere **cancellata** dal parent.
17. Se una variabile nel parent **è** referenziata → **non** va cancellata; va **collegata all’interfaccia del sottoflusso** tramite il task Subflow sul parent. **Non** si usano variabili «proxy» sintetiche: il wiring è solo **`subflowBindings`** sul task Subflow (`subflowBindingsSchemaVersion: 1`), voci `{ interfaceParameterId, parentVariableId }` con **`interfaceParameterId ≠ parentVariableId`** sempre.

### C) Etichette nel parent

18. Le variabili nel parent che restano (perché referenziate) **mantengono lo stesso GUID**; la **label** può riflettere che il valore arriva dal sottoflusso (convenzione di prodotto).
19. Regola di naming consigliata: `{NomeSottoflusso}.{labelOriginaria}`  
   Esempio: sottoflusso «Chiedi dati personali», variabile originaria `nome` → `Chiedi dati personali.nome`.
20. Il **GUID della variabile nel parent non cambia**.

### D) Mapping parent ↔ sottoflusso (S2)

21–24. **Una sola tabella di binding** sul task Subflow: `interfaceParameterId` (parametro interfaccia del flusso figlio) ↔ `parentVariableId` (variabile nel parent). **Nessun** `outputBindings` legacy (`from`/`to`), **nessun** merge implicito in Pop; runtime **PushFlow** / **PopFlow** applica solo questo mapping.

### E) Algoritmo operativo (con uso di `variabiliReferenziate`)

1. Calcolare **`variabiliReferenziate`** nel parent (scansione completa del flow parent).
2. Per ogni variabile associata al task spostato (stessi `varId` dei dati):
   - se `varId ∉ variabiliReferenziate` → **rimuovere dal parent**;
   - se `varId ∈ variabiliReferenziate` → **mantenere nel parent**, **rinominare** la label secondo §4C se serve, **stesso GUID**, e assicurare la riga corrispondente in **`subflowBindings`** (parametro interfaccia ↔ variabile parent).
3. Nel sottoflusso: creare **tutte** le variabili dei dati del task e subtask, **stessi GUID**.
4. Allineare **1:1** gli stessi GUID tra dati figlio e voci di `subflowBindings` lato parent.

---

## 5. Istruzioni per implementazione e review

- **Codice nuovo** (spostamento task, variabili, mapping, interfaccia): applicare rigorosamente questa specifica.
- **Codice esistente** che devia: trattare come **debito da allineare**.
- **Refactoring**: proporre allineamento agli invarianti sopra.
- **Documentazione**: aggiornare questo file se il modello evolve.

---

## 6. Esempio riassuntivo

- MAIN: task «Chiedi dati anagrafici» con tre dati D1, D2, D3 (`nome`, `cognome`, `eta`).
- D1 e D3 referenziate nel MAIN; D2 no.
- Dopo spostamento in sottoflusso «Dati anagrafici»:
  - Sottoflusso: tre variabili `nome`, `cognome`, `eta` con GUID **D1, D2, D3** invariati.
  - MAIN: restano **D1** e **D3** (variabili reali) con label tipo `Dati anagrafici.nome`, `Dati anagrafici.eta` se adottata la convenzione; **D2** rimossa dal MAIN se non referenziata.
  - Il task Subflow sul MAIN ha **`subflowBindings`** che mappa i parametri di interfaccia del figlio (id dedicati) alle variabili parent **D1**, **D3**; **D2** resta solo lato sottoflusso se non serve nel parent.

---

## 7. GrammarFlow (G2)

- Vedi **`docs/SEMANTICA_GRAMMAR_G2.md`**: slot grammaticali con id propri, **`slotBindings`** obbligatori verso variabili di flow (`taskId`), nessuna identità implicita con il task tree.

---

## 8. Riferimenti tipo nel codice (orientamento)

- `TaskTreeNode` in `src/types/taskTypes.ts` (`id`, `taskId`, `subNodes`).
- `VariableInstance` in `src/types/variableTypes.ts`.
- Task Subflow: `subflowBindings`, `subflowBindingsSchemaVersion` in `taskTypes` / compiler VB.
- Servizi variabili: `VariableCreationService`, utilità di scan riferimenti (da estendere/allineare allo standard di §3).

Questo documento è la **fonte di verità** del modello; il repository va adeguato, non il contrario.
