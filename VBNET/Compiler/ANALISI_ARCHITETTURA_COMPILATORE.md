# Analisi Architetturale del Compilatore

## Obiettivo
Verificare l'allineamento del compilatore al modello architetturale desiderato:
1. Ricostruzione autonoma del TaskTreeExpanded dai template
2. Materializzazione completa dell'albero (dataContract → NlpContract → CompiledNlpContract)
3. Produzione di CompiledTask autosufficiente per il runtime
4. Indipendenza da TaskTreeExpanded esterni generati dall'IDE

---

## 1. DOVE IL COMPILATORE È GIÀ ALLINEATO

### ✅ 1.1 Espansione Autonoma dai Template

**File:** `UtteranceTaskCompiler.vb`

**Funzione:** `BuildTaskTreeExpanded` (linee 187-256)
- ✅ Costruisce `TaskTreeExpanded` da zero usando `template.SubTasksIds`
- ✅ Non dipende da `TaskTreeExpanded` esterni
- ✅ Applica steps override dall'istanza (`instance.Steps`)
- ✅ Gestisce sia template compositi (con `SubTasksIds`) che atomici

**Funzione:** `BuildTaskTreeFromSubTasksIds` (linee 262-323)
- ✅ Dereferenzia ricorsivamente tutti i `templateId` in `subTasksIds`
- ✅ Supporta profondità arbitraria (ricorsione completa)
- ✅ Costruisce struttura completa internamente
- ✅ Gestisce cicli con `visitedTemplates`

**Conferma:** Il compilatore è **completamente autonomo** nella ricostruzione dell'albero.

---

### ✅ 1.2 Materializzazione Steps

**File:** `UtteranceTaskCompiler.vb`

**Funzione:** `ApplyStepsOverrides` (linee 331-384)
- ✅ Applica steps override dall'istanza ai nodi corretti (keyed per `templateId`)
- ✅ Gestisce ricorsivamente i subTasks
- ✅ Valida duplicati (stesso `Type` non può apparire due volte)
- ✅ Usa `DialogueStepListConverter` per conversione corretta

**Funzione:** `ApplyStepsToNode` (linee 415-455)
- ✅ Applica steps a un singolo nodo
- ✅ Validazione rigorosa (no duplicati)

**Conferma:** La materializzazione degli steps è **completa e corretta**.

---

### ✅ 1.3 Pipeline di Compilazione dataContract → NlpContract

**File:** `TaskAssembler.vb`

**Funzione:** `ConvertDataContractToNlpContract` (linee 493-714)
- ✅ Converte `dataContract` (JObject/Object) in `NLPContract`
- ✅ Gestisce array `contracts` e mappa correttamente in:
  - `regex` (RegexConfig)
  - `rules` (RulesConfig)
  - `ner` (NERConfig)
  - `llm` (LLMConfig)
- ✅ Estrae `subDataMapping`, `templateName`, `templateId`, ecc.
- ✅ Gestisce pattern, patternModes, ambiguity, testCases, ecc.

**Funzione:** `CompileNode` (linee 172-195)
- ✅ Verifica presenza di `ideNode.DataContract`
- ✅ Chiama `ConvertDataContractToNlpContract` se presente
- ✅ Compila in `CompiledNlpContract` usando `CompiledNlpContract.Compile`
- ✅ Valida risultato (`IsValid`) e lancia errore se fallisce
- ✅ Assegna `task.NlpContract` al runtime task

**Conferma:** La pipeline di compilazione è **completa e funzionale**, ma **non viene mai attivata** perché `DataContract` è sempre `Nothing`.

---

## 2. DOVE IL COMPILATORE È DISALLINEATO

### ❌ 2.1 Problema Critico: DataContracts → Constraints invece di DataContract

**File:** `UtteranceTaskCompiler.vb`

**Problema 1:** `BuildTaskTreeExpanded` - Nodo Radice (linee 204-215)

```vb
Dim rootNode As New Compiler.TaskNode() With {
    .Id = template.Id,
    .TemplateId = template.Id,
    .Steps = New List(Of Compiler.DialogueStep)(),
    .SubTasks = subNodes,
    .Constraints = If(template.DataContracts IsNot Nothing..., ...), ' ❌ Mette in Constraints
    .Condition = template.Condition
    ' ❌ MANCA: .DataContract = ... (non viene mai assegnato!)
}
```

**Evidenza:**
- `template.DataContracts` viene messo in `rootNode.Constraints`
- `rootNode.DataContract` rimane `Nothing` (default)
- Quando `TaskAssembler.CompileNode` cerca `ideNode.DataContract`, non lo trova

**Problema 2:** `BuildTaskTreeExpanded` - Template Atomico (linee 232-243)

```vb
Dim rootNode As New Compiler.TaskNode() With {
    .Id = template.Id,
    .TemplateId = template.Id,
    .Steps = New List(Of Compiler.DialogueStep)(),
    .SubTasks = New List(Of Compiler.TaskNode)(),
    .Constraints = If(template.DataContracts IsNot Nothing..., ...), ' ❌ Mette in Constraints
    .Condition = template.Condition
    ' ❌ MANCA: .DataContract = ... (non viene mai assegnato!)
}
```

**Stesso problema:** `DataContracts` va in `Constraints`, non in `DataContract`.

---

**Problema 3:** `BuildTaskTreeFromSubTasksIds` - Sub-Nodi (linee 289-310)

```vb
' ✅ Carica constraints dal template (priorità: dataContracts > constraints)
Dim templateConstraints As List(Of Object) = Nothing
If subTemplate.DataContracts IsNot Nothing AndAlso subTemplate.DataContracts.Count > 0 Then
    templateConstraints = subTemplate.DataContracts ' ❌ Prende DataContracts
ElseIf subTemplate.Constraints IsNot Nothing AndAlso subTemplate.Constraints.Count > 0 Then
    templateConstraints = subTemplate.Constraints
Else
    templateConstraints = New List(Of Object)()
End If

Dim node As New Compiler.TaskNode() With {
    .Id = subTemplate.Id,
    .TemplateId = subTemplate.Id,
    .Steps = New List(Of Compiler.DialogueStep)(),
    .SubTasks = New List(Of Compiler.TaskNode)(),
    .Constraints = templateConstraints, ' ❌ Mette in Constraints
    .Condition = subTemplate.Condition
    ' ❌ MANCA: .DataContract = ... (non viene mai assegnato!)
}
```

**Evidenza:**
- `subTemplate.DataContracts` viene messo in `node.Constraints`
- `node.DataContract` rimane `Nothing`
- Tutti i sub-nodi non hanno `DataContract`, quindi non possono compilare `NlpContract`

---

### ❌ 2.2 Consequenza: Pipeline di Compilazione Mai Attivata

**File:** `TaskAssembler.vb`

**Funzione:** `CompileNode` (linee 172-195)

```vb
' ✅ Converti dataContract in CompiledNlpContract se presente
If ideNode.DataContract IsNot Nothing Then
    ' ... compilazione ...
Else
    Console.WriteLine($"[TaskAssembler] No dataContract found for node {ideNode.Id}, NlpContract will remain Nothing")
End If
```

**Evidenza dai Log:**
```
[DIAG] TaskAssembler.CompileNode: ideNode.DataContract IsNothing=True
[TaskAssembler] No dataContract found for node ..., NlpContract will remain Nothing
```

**Consequenza:**
- `ideNode.DataContract` è sempre `Nothing`
- La condizione `If ideNode.DataContract IsNot Nothing` è sempre `False`
- La pipeline di compilazione `dataContract → NlpContract → CompiledNlpContract` **non viene mai eseguita**
- `task.NlpContract` rimane `Nothing` per tutti i nodi

---

### ❌ 2.3 Ignoranza del TaskTreeExpanded Fornito dall'IDE

**File:** `TaskCompilationService.vb`

**Funzione:** `CompileTaskTreeExpandedToCompiledTask` (linee 95-236)

**Flusso Attuale:**
1. Riceve `taskTreeExpanded` dall'IDE (con `dataContract` presente nei nodi)
2. Estrae `templateId` da `taskTreeExpanded`
3. Carica template dal database
4. **Ignora completamente** `taskTreeExpanded` fornito
5. Chiama `UtteranceTaskCompiler.Compile(task, ...)` che ricostruisce tutto da zero
6. `BuildTaskTreeExpanded` ricostruisce `TaskTreeExpanded` senza `dataContract`

**Evidenza:**
- Il `TaskTreeExpanded` dall'IDE (con `dataContract`) viene **completamente ignorato**
- Viene ricostruito da zero, perdendo i `dataContract` originali
- Questo è **corretto architetturalmente** (compilatore autonomo), ma **manca l'applicazione di `dataContract` dai template**

---

### ❌ 2.4 Runtime Riceve Grafo Incompleto

**Consequenza Finale:**

1. `BuildTaskTreeExpanded` crea nodi senza `DataContract`
2. `TaskAssembler.CompileNode` non trova `DataContract`, quindi non compila `NlpContract`
3. `RuntimeTask` ha `NlpContract = Nothing` per tutti i nodi
4. `CompiledTask` passa al runtime con `NlpContract = Nothing`
5. Runtime cerca di usare `NlpContract` per estrazione dati → **ERRORE**

**Errore Runtime:**
```
InvalidOperationException: Task node '...' has no NlpContract. NlpContract is mandatory for data extraction.
```

---

## 3. CONFERMA TECNICA

### ✅ 3.1 BuildTaskTreeExpanded Deve Ricostruire dai Template

**Conferma:** ✅ **CORRETTO**

Il compilatore deve essere autonomo e non dipendere da `TaskTreeExpanded` esterni. La ricostruzione da zero è l'approccio corretto.

**Ma:** Deve anche **applicare correttamente** i `dataContract` dai template ai nodi.

---

### ✅ 3.2 Pipeline di Compilazione Contratti è Completa

**Conferma:** ✅ **COMPLETA**

La pipeline `dataContract → NlpContract → CompiledNlpContract` è:
- ✅ Implementata correttamente
- ✅ Gestisce tutti i formati (JObject, String, Object)
- ✅ Mappa correttamente array `contracts` in oggetti `regex`, `rules`, `ner`, `llm`
- ✅ Valida e lancia errori se la compilazione fallisce

**Ma:** Non viene mai attivata perché `DataContract` è sempre `Nothing`.

---

### ✅ 3.3 Runtime Richiede Grafo Completamente Materializzato

**Conferma:** ✅ **RICHIESTO**

Il runtime (`Parser.vb`, `TryExtractData`) richiede:
- ✅ `taskNode.NlpContract IsNot Nothing` (errore bloccante se manca)
- ✅ `taskNode.NlpContract` deve essere `CompiledNlpContract`
- ✅ `CompiledMainRegex` deve essere compilato

**Evidenza:**
```vb
' Parser.vb, TryExtractData
If taskNode.NlpContract Is Nothing Then
    Throw New InvalidOperationException($"Task node '{taskNode.Id}' has no NlpContract. NlpContract is mandatory for data extraction.")
End If
```

**Consequenza:** Il runtime **fallisce immediatamente** se `NlpContract` è `Nothing`.

---

## 4. PIANO DI CORREZIONE PROPOSTO

### 📋 STEP 1: Applicare DataContract ai Nodi durante la Costruzione

**Obiettivo:** Estrarre `dataContract` da `template.DataContracts` e assegnarlo a `TaskNode.DataContract`.

#### 1.1 Modifica `BuildTaskTreeExpanded` - Nodo Radice

**File:** `UtteranceTaskCompiler.vb`, linee 204-215

**Modifica Proposta:**
```vb
' ✅ Estrai dataContract dal template (primo elemento di DataContracts, se presente)
Dim rootDataContract As Object = Nothing
If template.DataContracts IsNot Nothing AndAlso template.DataContracts.Count > 0 Then
    ' Prendi il primo elemento (o quello con templateId matching)
    rootDataContract = template.DataContracts(0)
End If

Dim rootNode As New Compiler.TaskNode() With {
    .Id = template.Id,
    .TemplateId = template.Id,
    .Steps = New List(Of Compiler.DialogueStep)(),
    .SubTasks = subNodes,
    .Constraints = If(template.Constraints IsNot Nothing..., ...), ' ✅ Solo Constraints, non DataContracts
    .DataContract = rootDataContract, ' ✅ NUOVO: Assegna dataContract
    .Condition = template.Condition
}
```

**Stessa modifica per template atomico** (linee 232-243).

---

#### 1.2 Modifica `BuildTaskTreeFromSubTasksIds` - Sub-Nodi

**File:** `UtteranceTaskCompiler.vb`, linee 289-310

**Modifica Proposta:**
```vb
' ✅ Estrai dataContract dal template (primo elemento di DataContracts, se presente)
Dim nodeDataContract As Object = Nothing
If subTemplate.DataContracts IsNot Nothing AndAlso subTemplate.DataContracts.Count > 0 Then
    ' Prendi il primo elemento (o quello con templateId matching)
    nodeDataContract = subTemplate.DataContracts(0)
End If

' ✅ Carica constraints dal template (solo Constraints, non DataContracts)
Dim templateConstraints As List(Of Object) = Nothing
If subTemplate.Constraints IsNot Nothing AndAlso subTemplate.Constraints.Count > 0 Then
    templateConstraints = subTemplate.Constraints
Else
    templateConstraints = New List(Of Object)()
End If

Dim node As New Compiler.TaskNode() With {
    .Id = subTemplate.Id,
    .TemplateId = subTemplate.Id,
    .Steps = New List(Of Compiler.DialogueStep)(),
    .SubTasks = New List(Of Compiler.TaskNode)(),
    .Constraints = templateConstraints, ' ✅ Solo Constraints
    .DataContract = nodeDataContract, ' ✅ NUOVO: Assegna dataContract
    .Condition = subTemplate.Condition
}
```

---

### 📋 STEP 2: Validazione Post-Compilazione

**Obiettivo:** Verificare che tutti i nodi che richiedono `NlpContract` lo abbiano dopo la compilazione.

**File:** `UtteranceTaskCompiler.vb`, dopo `taskCompiler.Compile(taskJson)`

**Modifica Proposta:**
```vb
Dim compileResult = taskCompiler.Compile(taskJson)
If compileResult IsNot Nothing AndAlso compileResult.Task IsNot Nothing Then
    Dim runtimeTask = compileResult.Task

    ' ✅ Validazione: verifica che nodi che richiedono NlpContract lo abbiano
    ValidateNlpContracts(runtimeTask)

    compiledTask.Steps = runtimeTask.Steps
    ' ... resto del codice ...
End If
```

**Funzione di Validazione:**
```vb
Private Sub ValidateNlpContracts(runtimeTask As RuntimeTask)
    ' Se il task richiede NlpContract (es. DataRequest), deve averlo
    If runtimeTask.NlpContract Is Nothing Then
        ' Verifica se è un task che richiede NlpContract
        ' (per ora, assumiamo che tutti i task lo richiedano se hanno SubTasks vuoti)
        If runtimeTask.SubTasks Is Nothing OrElse runtimeTask.SubTasks.Count = 0 Then
            Console.WriteLine($"[WARNING] Task {runtimeTask.Id} has no NlpContract but may require it")
            ' Non bloccare, ma loggare
        End If
    End If

    ' Ricorsivo per subTasks
    If runtimeTask.HasSubTasks() Then
        For Each subTask In runtimeTask.SubTasks
            ValidateNlpContracts(subTask)
        Next
    End If
End Sub
```

---

### 📋 STEP 3: Validazione Finale del Grafo Completo

**Obiettivo:** Assicurare che il `CompiledTask` finale sia autosufficiente.

**File:** `TaskCompilationService.vb`, dopo `CompileTaskToRuntime`

**Modifica Proposta:**
```vb
Dim compileResult = CompileTaskToRuntime(task, allTemplates)
If Not compileResult.Success Then
    Return New CompileTaskResult(False, Nothing, compileResult.ErrorMessage)
End If

' ✅ Validazione finale: verifica che CompiledTask sia completo
Dim validationErrors = ValidateCompiledTask(compileResult.Result)
If validationErrors.Count > 0 Then
    Return New CompileTaskResult(False, Nothing, $"CompiledTask validation failed: {String.Join(", ", validationErrors)}")
End If
```

**Funzione di Validazione:**
```vb
Private Function ValidateCompiledTask(compiledTask As CompiledUtteranceTask) As List(Of String)
    Dim errors As New List(Of String)()

    ' Verifica che abbia Steps o SubTasks
    If (compiledTask.Steps Is Nothing OrElse compiledTask.Steps.Count = 0) AndAlso
       Not compiledTask.HasSubTasks() Then
        errors.Add($"Task {compiledTask.Id} has no Steps or SubTasks")
    End If

    ' Verifica che non ci siano riferimenti a template esterni
    ' (tutti i TemplateId devono essere risolti)

    ' Ricorsivo per subTasks
    If compiledTask.HasSubTasks() Then
        For Each subTask In compiledTask.SubTasks
            errors.AddRange(ValidateCompiledTask(subTask))
        Next
    End If

    Return errors
End Function
```

---

## 5. PRIORITÀ DI IMPLEMENTAZIONE

### 🔴 Priorità 1 (Critico)
- **STEP 1.1 e 1.2:** Applicare `dataContract` ai nodi durante la costruzione
- **Impatto:** Risolve il problema principale (NlpContract sempre Nothing)

### 🟡 Priorità 2 (Importante)
- **STEP 2:** Validazione post-compilazione
- **Impatto:** Identifica nodi che richiedono NlpContract ma non lo hanno

### 🟢 Priorità 3 (Miglioramenti)
- **STEP 3:** Validazione finale del grafo completo
- **Impatto:** Assicura che CompiledTask sia autosufficiente

---

## 6. RISCHI E CONSIDERAZIONI

### ⚠️ Rischio 1: Formato DataContracts nel Database
- I template nel database potrebbero avere `DataContracts` in formato diverso
- **Mitigazione:** Validare formato durante estrazione
- **Test:** Verificare con template esistenti

### ⚠️ Rischio 2: Template Legacy senza DataContracts
- Template vecchi potrebbero non avere `DataContracts`
- **Mitigazione:** Gestire gracefully (NlpContract rimane Nothing, ma non blocca)
- **Test:** Verificare retrocompatibilità

### ⚠️ Rischio 3: DataContracts Multipli
- Un template potrebbe avere più `DataContracts` (uno per nodo)
- **Mitigazione:** Implementare logica di matching per `templateId`
- **Test:** Verificare con template complessi

---

## 7. CONCLUSIONE

### ✅ Punti di Forza
1. Compilatore è autonomo nella ricostruzione
2. Pipeline di compilazione contratti è completa
3. Materializzazione steps è corretta

### ❌ Punti Critici
1. `DataContracts` viene messo in `Constraints` invece di `DataContract`
2. Pipeline di compilazione contratti non viene mai attivata
3. Runtime riceve grafo incompleto (NlpContract = Nothing)

### 🎯 Soluzione Minima
**Modifiche minime necessarie:**
- STEP 1.1 e 1.2: Assegnare `DataContract` ai nodi durante la costruzione
- **Impatto:** Basso (solo 2 funzioni)
- **Rischio:** Basso (logica semplice)
- **Beneficio:** Alto (risolve problema principale)

---

**Data:** 2025-01-27
**Autore:** Analisi Architetturale
**Stato:** ✅ STEP 1 Implementato

---

## 8. STATO IMPLEMENTAZIONE

### ✅ STEP 1: Completato con Modello Rigoroso (2025-01-27)

**Modifiche Applicate:**
- ✅ **Aggiunto campo `DataContract` (singolare) al modello `Task`** - Permette la deserializzazione del campo `dataContract` dal database
- ✅ **`BuildTaskTreeExpanded` - Nodo Radice (template composito):** Usa SOLO `template.DataContract` con validazione rigorosa (errore se manca)
- ✅ **`BuildTaskTreeExpanded` - Template Atomico:** Usa SOLO `template.DataContract` con validazione rigorosa (errore se manca)
- ✅ **`BuildTaskTreeFromSubTasksIds` - Sub-Nodi:** Usa SOLO `subTemplate.DataContract` con validazione rigorosa (errore se manca)
- ✅ **Rimossi TUTTI i fallback:** Nessun uso di `DataContracts(0)`, nessun fallback a `Constraints`
- ✅ **Validazione rigorosa:** Se `DataContract` è `Nothing` → `InvalidOperationException` con messaggio chiaro

**File Modificati:**
- `VBNET/Compiler/DTO/IDE/Task.vb` - Aggiunto campo `DataContract`
- `VBNET/Compiler/TaskCompiler/UtteranceTaskCompiler.vb` - Modificato per usare `DataContract` con validazione

**Modello Implementato:**
- ✅ Il template nel database è la fonte autorevole della semantica NLP
- ✅ Ogni template DEVE contenere il campo `dataContract` (singolare)
- ✅ Il compilatore legge questo campo e lo applica ai nodi
- ✅ Nessun fallback: se manca → errore esplicito
- ✅ Il runtime riceverà un grafo completamente materializzato

**Risultato Atteso:**
- I nodi ora hanno `DataContract` popolato direttamente dal template nel database
- `TaskAssembler.CompileNode` trova `DataContract` e compila `NlpContract`
- La pipeline `dataContract → NlpContract → CompiledNlpContract` viene attivata
- Se un template non ha `dataContract` → errore esplicito durante la compilazione

**Prossimi Step:**
- 🟡 STEP 2: Validazione post-compilazione (opzionale, per verificare che `CompiledNlpContract` sia valido)
- 🟢 STEP 3: Validazione finale del grafo completo (opzionale, per assicurare autosufficienza)
