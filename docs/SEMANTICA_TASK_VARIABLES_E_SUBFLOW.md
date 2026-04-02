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

### B) Flow parent

15. Dopo lo spostamento, le variabili legate a quel task nel parent sono potenzialmente **orfane** rispetto al task, ma possono essere ancora **referenziate** ovunque nel parent (condizioni, messaggi, ecc.) oppure **no**.
16. Se una variabile nel parent **non** è referenziate da nessuna parte → può essere **cancellata** dal parent.
17. Se una variabile nel parent **è** referenziate → **non** va cancellata; va **collegata all’interfaccia del sottoflusso** e mantenuta come variabile di proxy nel parent.

### C) Rinomina nel parent

18. La variabile nel parent che resta (perché referenziata) **mantiene lo stesso GUID**; la **label** deve riflettere che il valore arriva dal sottoflusso.
19. Regola di naming consigliata: `{NomeSottoflusso}.{labelOriginaria}`  
   Esempio: sottoflusso «Chiedi dati personali», variabile originaria `nome` → `Chiedi dati personali.nome`.
20. Il **GUID della variabile nel parent non cambia**.

### D) Mapping parent ↔ sottoflusso

21–24. Mapping **1:1 sullo stesso GUID**:  
`FlowParent.variable(guid)` ↔ `SubFlow.variable(guid)` con etichette eventualmente diverse.  
L’identità di GUID uguale su entrambi i lati è **intenzionale** e semplifica binding e comprensione («stesso valore logico»).

### E) Algoritmo operativo (con uso di `variabiliReferenziate`)

1. Calcolare **`variabiliReferenziate`** nel parent (scansione completa del flow parent).
2. Per ogni variabile associata al task spostato (stessi `varId` dei dati):
   - se `varId ∉ variabiliReferenziate` → **rimuovere dal parent**;
   - se `varId ∈ variabiliReferenziate` → **mantenere nel parent**, **rinominare** la label secondo §4C, **stesso GUID**, **collegare** all’interfaccia del sottoflusso.
3. Nel sottoflusso: creare **tutte** le variabili dei dati del task e subtask, **stessi GUID**.
4. Creare il **mapping** parent ↔ sottoflusso basato sul GUID (1:1).

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
  - MAIN: restano solo proxy per **D1** e **D3** con label tipo `Dati anagrafici.nome`, `Dati anagrafici.eta`; **D2** rimossa dal MAIN se non referenziata.
  - Mapping: **D1↔D1**, **D3↔D3** sul parent; **D2** solo nel sottoflusso se non serve nel parent.

---

## 7. Riferimenti tipo nel codice (orientamento)

- `TaskTreeNode` in `src/types/taskTypes.ts` (`id`, `taskId`, `subNodes`).
- `VariableInstance` in `src/types/variableTypes.ts`.
- Servizi variabili: `VariableCreationService`, utilità di scan riferimenti (da estendere/allineare allo standard di §3).

Questo documento è la **fonte di verità** del modello; il repository va adeguato, non il contrario.
