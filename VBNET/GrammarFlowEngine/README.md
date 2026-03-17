# Grammar Flow Engine

Grammar Flow Engine è un motore per interpretare grammatiche basate su grafi (grammar flow) in VB.NET.

## Architettura

```
Front end (TypeScript/React)
    ↓ (Grammar JSON)
Grammar Compiler (VB.NET)
    ↓ (CompiledGrammar)
Grammar Flow Engine (VB.NET)
    ↓ (ParseResult con bindings estratti)
```

## Struttura del Progetto

```
GrammarFlowEngine/
├── Models/              # Modelli base (Grammar, GrammarNode, GrammarEdge, ecc.)
├── Compiler/            # GrammarCompiler: compila Grammar → CompiledGrammar
│   ├── GrammarCompiler.vb
│   ├── CompiledGrammar.vb
│   ├── CompiledNode.vb
│   └── CompiledEdge.vb
└── Interpreter/         # Grammar Flow Engine: interpreta CompiledGrammar
    ├── GrammarFlowEngine.vb    # Classe principale pubblica
    ├── NavigationEngine.vb      # Motore di navigazione con memoization
    ├── NodeMatcher.vb           # Match di un singolo nodo
    ├── EdgeNavigator.vb         # Navigazione edge (sequential/alternative/optional)
    ├── GarbageHandler.vb        # Gestione garbage words
    ├── LookaheadChecker.vb      # Lookahead per early termination
    ├── ResultSelector.vb        # Selezione migliori risultati
    ├── MatchContext.vb          # Contesto di match
    ├── MatchResult.vb           # Risultato di un match
    └── ParseResult.vb           # Risultato finale del parsing
```

## Caratteristiche

### ✅ Funzionalità Implementate

1. **Compilazione Grammar**
   - Pre-compilazione regex
   - Ottimizzazione strutture (HashSet per synonyms, Dictionary per lookup)
   - Identificazione entry nodes

2. **Interpretazione**
   - Navigazione del grafo con backtracking controllato
   - Memoization per evitare ricalcoli
   - Protezione contro cicli infiniti
   - Early termination con lookahead

3. **Gestione Edge Types**
   - **Sequential**: tutti gli edge devono matchare in ordine
   - **Alternative**: almeno uno degli edge deve matchare
   - **Optional**: prova con e senza l'edge

4. **Gestione Nodi**
   - **Optional**: nodi che possono essere skippati
   - **Repeatable**: nodi che possono matchare più volte
   - Match tramite: regex, label, synonyms, semantic-set, semantic-value

5. **Garbage Words**
   - Supporto per parole "garbage" tra nodi (max configurabile)
   - Lookahead per evitare backtracking inutile

6. **Estrazione Bindings**
   - Slot binding
   - Semantic-set binding
   - Semantic-value binding

## Utilizzo

### Esempio Base

```vb
' Carica grammar da JSON
Dim json = File.ReadAllText("grammar.json")
Dim grammar = JsonConvert.DeserializeObject(Of Grammar)(json)

' Crea engine (compila automaticamente)
Dim engine As New GrammarFlowEngine(grammar)

' Parse testo
Dim result = interpreter.Parse("voglio un biglietto per Milano")

If result.Success Then
    ' Accedi ai bindings estratti
    For Each kvp In result.Bindings
        Console.WriteLine($"{kvp.Key} = {kvp.Value}")
    Next
End If
```

### Esempio con Grammar Compilato

```vb
' Compila grammar una volta
Dim compiledGrammar = GrammarCompiler.Compile(grammar)

' Crea engine con grammar già compilato
Dim engine As New GrammarFlowEngine(compiledGrammar)

' Parse multipli (riutilizza la compilazione)
Dim result1 = interpreter.Parse("voglio un biglietto")
Dim result2 = interpreter.Parse("vorrei un biglietto per Roma")
```

## Performance

- **Compilazione**: una volta all'inizializzazione
- **Parsing**: O(N × M × L) dove N = nodi, M = max garbage, L = lunghezza testo
- **Ottimizzazioni**:
  - Memoization per evitare ricalcoli
  - Early termination con lookahead
  - Pre-compilazione regex
  - HashSet per lookup veloce di synonyms

## Note di Implementazione

### Greedy vs Backtracking Completo

`NavigateSequential` usa un approccio **greedy**: per ogni step sceglie il miglior risultato locale. Questo è più veloce ma potrebbe non trovare la soluzione ottimale globale. Se necessario, può essere modificato per usare backtracking completo (più costoso ma ottimale).

### Ordine degli Edge

Gli edge sequential sono ordinati per il campo `Order`. Se `Order` non è impostato, viene usato l'ordine di inserimento. È consigliabile impostare esplicitamente `Order` per garantire un ordine deterministico.

### Garbage Words

Il limite di default per garbage words è 5, ma può essere configurato nel metodo `Parse`:

```vb
Dim result = interpreter.Parse(text, maxGarbage:=10)
```

## Dipendenze

- .NET 8.0
- Newtonsoft.Json 13.0.3
- Common (progetto VB.NET nella solution)
