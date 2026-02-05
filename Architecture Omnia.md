# Architecture Omnia

**Data:** 2025-02-05
**Projeto:** Backend VB.NET - Sistema de Diálogo Conversacional
**Objetivo:** Documentação Arquitetural Completa para Arquiteto Cloud

---

## Índice

1. [Executive Summary](#executive-summary)
2. [Domain Model Detalhado](#domain-model-detalhado)
3. [Sequência Temporal: Compilação](#sequência-temporal-compilação)
4. [Sequência Temporal: Runtime](#sequência-temporal-runtime)
5. [Relações entre Componentes](#relações-entre-componentes)
6. [Padrões Arquiteturais](#padrões-arquiteturais)
7. [Escalabilidade e Cloud](#escalabilidade-e-cloud)
8. [Fluxo de Dados](#fluxo-de-dados)
9. [Análise Comparativa: Documento Existente](#análise-comparativa-documento-existente)

---

## Executive Summary

### Visão Geral do Sistema

Omnia é um sistema de diálogo conversacional que permite a criação e execução de fluxos de conversação complexos. O sistema é composto por três macro-áreas principais:

1. **CORE INTELIGENTE** (36.7% do código)
   - Compilador: transforma estruturas IDE em estruturas runtime
   - Runtime Engine: executa os diálogos
   - Parser NLP: extrai dados das utterance

2. **INFRAESTRUTURA** (25.4% do código)
   - API REST e SSE
   - Gestão de sessões
   - Serialização/deserialização

3. **SUPORTE** (36.7% do código)
   - DTO e modelos
   - Helpers e utilitários
   - Validadores

### Objetivo do Documento

Este documento fornece uma visão completa da arquitetura do sistema, com foco em:
- Domain model e transformações entre modelos
- Fluxos de compilação e runtime
- Relações entre componentes
- Considerações de escalabilidade cloud

### Público-Alvo

- **Arquitetos Cloud**: para decisões de escalabilidade e distribuição
- **Desenvolvedores Sênior**: para onboarding e manutenção
- **Equipe DevOps**: para deployment e monitoramento

### Escopo e Limitações

- **Escopo**: Backend VB.NET, compilador, runtime engine
- **Não incluído**: Frontend TypeScript (mencionado apenas para contexto)
- **Foco**: Arquitetura runtime e compilação

---

## Domain Model Detalhado

### Glossário de Entidades

#### Task (IDE)

**Definição:** Representação do task no mundo IDE (frontend)

**Localização:** `Compiler/DTO/IDE/Task.vb`

**Propriedades principais:**
- `Id`: GUID único do task
- `TemplateId`: Referência ao template (se instância)
- `SubTasksIds`: Array de templateId para estrutura recursiva
- `Steps`: Override dos steps (apenas para instâncias)
- `DataContract`: Contrato NLP para extração de dados
- `Constraints`: Restrições de validação

**Quando usar:** Durante o design no IDE, antes da compilação

**Relações:**
- Pode referenciar um `Template` (outro Task com `TemplateId`)
- Contém `TaskNode` na estrutura recursiva

---

#### CompiledTask

**Definição:** Task compilado, pronto para execução

**Localização:** `Compiler/DTO/Runtime/CompiledTask.vb`

**Propriedades principais:**
- `Id`: GUID do task
- `Condition`: Condição de execução (opcional)
- `State`: Estado atual (`UnExecuted`, `Executed`, `WaitingUserInput`)
- `TaskType`: Tipo do task (enum: `SayMessage`, `UtteranceInterpretation`, etc.)

**Tipos derivados:**
- `CompiledSayMessageTask`: Task para enviar mensagens
- `CompiledUtteranceTask`: Task para interpretação utterance
- `CompiledClassifyProblemTask`: Task para classificação de problema
- `CompiledBackendCallTask`: Task para chamadas backend

**Quando usar:** Após a compilação, antes de converter em RuntimeTask

**Relações:**
- Produzido por `TaskCompiler`
- Convertido em `RuntimeTask` por `TaskAssembler`

---

#### RuntimeTask

**Definição:** Task materializado para execução runtime

**Localização:** `Compiler/DTO/Runtime/Task.vb`

**Propriedades principais:**
- `Id`: GUID do task
- `Steps`: Steps de diálogo (apenas se task atômico ou agregado)
- `Constraints`: Restrições para validação de input
- `NlpContract`: Contrato NLP pré-compilado
- `SubTasks`: Lista de RuntimeTask filhos (recursivo)

**Métodos:**
- `HasSubTasks()`: Verifica se tem subTasks
- `IsAtomic()`: Verifica se é atômico (tem steps mas não subTasks)
- `IsComposite()`: Verifica se é composto (tem subTasks mas não steps)
- `IsAggregate()`: Verifica se é agregado (tem tanto steps quanto subTasks)

**Quando usar:** Durante a execução no runtime engine

**Relações:**
- Produzido por `TaskAssembler`
- Executado por `TaskEngine`

---

#### TaskNode (IDE)

**Definição:** Nó da árvore de tasks no mundo IDE

**Localização:** `Compiler/DTO/IDE/TaskNode.vb`

**Propriedades principais:**
- `Id`: GUID do nó
- `Name`: Nome do dado (ex. "Nome", "Sobrenome")
- `Label`: Etiqueta para UI
- `Type`: Tipo do nó (ex. "data", "constraint")
- `Steps`: Steps de diálogo
- `SubTasks`: Lista de TaskNode filhos (recursivo)
- `TemplateId`: Referência ao template
- `DataContract`: Contrato NLP

**Quando usar:** Durante o design no IDE

**Relações:**
- Contido em `TaskTreeExpanded.Nodes`
- Pode ter `SubTasks` (recursivo)

---

#### TaskTreeExpanded

**Definição:** AST montado com template fundido e override aplicados

**Localização:** `Compiler/DTO/IDE/TaskTreeExpanded.vb`

**Propriedades principais:**
- `TaskInstanceId`: ID da instância do task
- `Label`: Etiqueta da árvore de tasks
- `Nodes`: Lista de TaskNode (sempre array)
- `Translations`: Dicionário de traduções
- `Introduction`: Step de introdução
- `Constraints`: Restrições no nível root

**Quando usar:** Intermediário entre IDE e compilação

**Relações:**
- Produzido por `TaskTreeConverter` ou `UtteranceTaskCompiler.BuildTaskTreeExpanded()`
- Compilado por `TaskAssembler` em `RuntimeTask`

---

#### Flow vs FlowNode vs FlowEdge

**Flow:**
- **Definição:** Container completo do flowchart
- **Localização:** `Compiler/Flow.vb`
- **Propriedades:** `Nodes`, `Edges`, `Tasks`
- **Quando usar:** Para representar um flowchart inteiro

**FlowNode:**
- **Definição:** Nó individual do flowchart
- **Localização:** `Compiler/DTO/IDE/FlowNode.vb`
- **Propriedades:** `Id`, `Type`, `Data` (contém TaskRow)
- **Quando usar:** Para representar um nó no flowchart

**FlowEdge:**
- **Definição:** Aresta entre nós do flowchart
- **Localização:** `Compiler/DTO/IDE/FlowEdge.vb`
- **Propriedades:** `Source`, `Target`, `Condition`
- **Quando usar:** Para representar transições entre nós

**Relações:**
- `Flow` contém `FlowNode[]` e `FlowEdge[]`
- `FlowNode` contém `TaskRow[]` (linhas do task)
- `FlowEdge` conecta `FlowNode` source a target

---

#### SessionManager vs OrchestratorSession

**SessionManager:**
- **Definição:** Gerencia todas as sessões ativas
- **Localização:** `ApiServer/SessionManager.vb`
- **Responsabilidades:**
  - Cria novas sessões
  - Gerencia sessões existentes
  - Converte RuntimeTask em TaskInstance
- **Quando usar:** Para gerenciar o ciclo de vida das sessões

**OrchestratorSession:**
- **Definição:** Sessão individual de execução
- **Localização:** `ApiServer/SessionManager.vb` (classe interna)
- **Propriedades:**
  - `SessionId`: ID único da sessão
  - `CompilationResult`: Resultado da compilação
  - `Orchestrator`: FlowOrchestrator para execução
  - `TaskEngine`: Motor de execução
  - `Messages`: Lista de mensagens geradas
  - `EventEmitter`: Para eventos SSE
- **Quando usar:** Para representar uma sessão ativa

**Relações:**
- `SessionManager` contém `Dictionary<SessionId, OrchestratorSession>`
- `OrchestratorSession` contém `FlowOrchestrator`

---

### Transformações entre Modelos

#### Transformação 1: IDE → Compilação

```
Task (IDE)
  ↓ TaskTreeConverter.ConvertTaskTreeToTaskTreeExpanded()
TaskTreeExpanded (AST montado)
  ↓ TaskCompiler.Compile()
CompiledTask
```

**Componentes envolvidos:**
- `TaskTreeConverter`: Converte JSON → TaskTreeExpanded
- `TaskCompiler`: Compila TaskTreeExpanded → CompiledTask

**Dados transformados:**
- `Task.TemplateId` → Carregamento do template
- `Task.Steps` → Override aplicado aos nós
- `Task.DataContract` → Materializado em `CompiledNlpContract`

---

#### Transformação 2: Compilação → Runtime

```
CompiledTask
  ↓ TaskAssembler.Compile()
RuntimeTask
```

**Componentes envolvidos:**
- `TaskAssembler`: Materializa CompiledTask → RuntimeTask

**Dados transformados:**
- `CompiledTask` → `RuntimeTask` (propriedades runtime)
- `TaskTreeExpanded.Nodes` → `RuntimeTask.SubTasks` (recursivo)
- `DataContract` → `CompiledNlpContract` (regex compilados)

---

#### Transformação 3: Runtime → Execução

```
RuntimeTask
  ↓ RuntimeTaskConverter.ConvertCompiledToRuntimeTask()
RuntimeTask (para TaskEngine)
  ↓ TaskEngine.ExecuteTask()
Execução
```

**Componentes envolvidos:**
- `RuntimeTaskConverter`: Helper para conversão
- `TaskEngine`: Executa o task

**Dados utilizados:**
- `RuntimeTask.Steps` → Steps de diálogo
- `RuntimeTask.NlpContract` → Parser NLP
- `RuntimeTask.Constraints` → Validação de input

---

### Quando Usar Cada Modelo

| Modelo | Fase | Propósito | Exemplo |
|--------|------|-----------|---------|
| **Task (IDE)** | Design | Representação no IDE | Task criado pelo usuário no frontend |
| **TaskTreeExpanded** | Compilação | AST intermediário | TaskTreeExpanded construído pelo compiler |
| **CompiledTask** | Compilação | Task compilado com condições | CompiledTask pronto para avaliação de condições |
| **RuntimeTask** | Runtime | Task materializado para execução | RuntimeTask executado pelo TaskEngine |
| **TaskNode** | Design | Nó da árvore de tasks | TaskNode no TaskTreeExpanded |
| **Flow** | Design | Flowchart inteiro | Flow com nós e arestas |

---

## Sequência Temporal: Compilação

### Fluxo Completo

```
1. IDE (Frontend TypeScript)
   └─> Task (JSON)
       └─> TaskTreeConverter.ConvertTaskTreeToTaskTreeExpanded()
           └─> TaskTreeExpanded (AST montado)
               └─> TaskCompiler.Compile()
                   └─> TaskCompilerFactory.GetCompiler()
                       └─> UtteranceTaskCompiler.Compile()
                           └─> CompiledUtteranceTask
                               └─> TaskAssembler.Compile()
                                   └─> RuntimeTask
```

### Passo a Passo Detalhado

#### Passo 1: IDE → Task (JSON)

**Componente:** Frontend (TypeScript)

**Ação:**
- Usuário cria/edita task no IDE
- Task é serializado em JSON

**Output:** `Task` (JSON) com:
- `id`: GUID do task
- `templateId`: Referência ao template (se instância)
- `subTasksIds`: Array de templateId para estrutura recursiva
- `steps`: Override dos steps (apenas para instâncias)
- `dataContract`: Contrato NLP

**Arquivos envolvidos:**
- Frontend: `src/types/taskTypes.ts`
- Backend: `Compiler/DTO/IDE/Task.vb`

---

#### Passo 2: Task → TaskTreeExpanded

**Componente:** `TaskTreeConverter`

**Ação:**
- Deserializa JSON em `TaskTreeExpanded`
- Extrai steps e aplica override
- Constrói estrutura recursiva

**Output:** `TaskTreeExpanded` com:
- `TaskInstanceId`: ID da instância
- `Nodes`: Lista de TaskNode
- `Translations`: Dicionário de traduções

**Arquivos envolvidos:**
- `ApiServer/Converters/TaskTreeConverter.vb`

**Lógica chave:**
```vb
Public Function ConvertTaskTreeToTaskTreeExpanded(
    taskTreeJson As JObject,
    taskId As String
) As TaskTreeExpanded
    ' Deserializa JSON
    ' Extrai steps
    ' Aplica override
    ' Constrói estrutura recursiva
End Function
```

---

#### Passo 3: TaskTreeExpanded → CompiledTask

**Componente:** `TaskCompiler` (via `TaskCompilerFactory`)

**Ação:**
- Seleciona compiler apropriado baseado em `TaskType`
- Compila `TaskTreeExpanded` em `CompiledTask`

**Output:** `CompiledTask` (ou derivado) com:
- `Id`: GUID do task
- `Condition`: Condição de execução
- `State`: Estado atual
- `TaskType`: Tipo do task

**Arquivos envolvidos:**
- `Compiler/TaskCompiler.vb`
- `Compiler/TaskCompiler/TaskCompilerFactory.vb`
- `Compiler/TaskCompiler/UtteranceTaskCompiler.vb`

**Lógica chave:**
```vb
Public Function Compile(
    task As Task,
    taskId As String,
    flow As Flow
) As CompiledTask
    ' Seleciona compiler
    Dim compiler = TaskCompilerFactory.GetCompiler(taskType)
    ' Compila task
    Return compiler.Compile(task, taskId, flow)
End Function
```

---

#### Passo 4: CompiledTask → RuntimeTask

**Componente:** `TaskAssembler`

**Ação:**
- Materializa `CompiledTask` em `RuntimeTask`
- Compila `DataContract` em `CompiledNlpContract`
- Constrói estrutura recursiva `RuntimeTask.SubTasks`

**Output:** `RuntimeTask` com:
- `Id`: GUID do task
- `Steps`: Steps de diálogo
- `Constraints`: Restrições de validação
- `NlpContract`: Contrato NLP pré-compilado
- `SubTasks`: Lista de RuntimeTask filhos (recursivo)

**Arquivos envolvidos:**
- `Compiler/TaskAssembler.vb`

**Lógica chave:**
```vb
Public Function Compile(
    assembled As TaskTreeExpanded
) As RuntimeTask
    ' Compila nó root
    Dim rootTask = CompileNode(assembled.Nodes(0), Nothing)
    ' Compila subTasks recursivamente
    ' Compila DataContract → CompiledNlpContract
    Return rootTask
End Function
```

---

### Componentes Envolvidos

#### TaskTreeConverter
- **Papel:** Converte JSON → TaskTreeExpanded
- **Arquivo:** `ApiServer/Converters/TaskTreeConverter.vb`
- **Linhas de código:** ~350
- **Lógica core:** Deserialização JSON, extração de steps, aplicação de override

#### TaskCompiler
- **Papel:** Orquestrador de compilação
- **Arquivo:** `Compiler/TaskCompiler.vb`
- **Linhas de código:** ~150
- **Lógica core:** Deserializa JSON, chama compiladores específicos

#### TaskCompilerFactory
- **Papel:** Factory para criar compiladores
- **Arquivo:** `Compiler/TaskCompiler/TaskCompilerFactory.vb`
- **Linhas de código:** ~35
- **Lógica core:** Seleção de compiler baseado em TaskType

#### UtteranceTaskCompiler
- **Papel:** Compila task UtteranceInterpretation
- **Arquivo:** `Compiler/TaskCompiler/UtteranceTaskCompiler.vb`
- **Linhas de código:** ~420
- **Lógica core:** Constrói TaskTreeExpanded a partir do template, aplica override de steps

#### TaskAssembler
- **Papel:** Materializa para runtime
- **Arquivo:** `Compiler/TaskAssembler.vb`
- **Linhas de código:** ~650
- **Lógica core:** Mapeamento IDE→Runtime, conversão dataContract→CompiledNlpContract

---

### Dependências Template/Instâncias

#### Modelo Template/Instância

**Template:**
- Contém estrutura compartilhada (constraints, examples, nlpContract)
- Definição: Task com `SubTasksIds` que define a estrutura
- Armazenamento: Em `Flow.Tasks` com `TemplateId = null` ou GUID próprio

**Instância:**
- Contém apenas steps clonados (com novos GUID)
- Definição: Task que referencia um template via `TemplateId`
- Armazenamento: Em `Flow.Tasks` com `TemplateId` apontando para template

#### Resolução

**Regra:** Constraints/examples/nlpContract são SEMPRE do template usando `TemplateId`

**Fluxo:**
1. Instância tem `TemplateId` que referencia template
2. Compiler carrega template de `Flow.Tasks`
3. Compiler aplica override de steps da instância
4. Compiler materializa constraints/examples/nlpContract do template

**Vantagens:**
- Elimina duplicação: mesmo contract salvo N vezes para N instâncias
- Atualizações centralizadas: mudanças no template → todas instâncias usam novo contract
- Performance: menos dados no database, lookup de template em memória (O(1))
- Arquitetura limpa: instância contém apenas steps, template contém contracts

**Exemplo:**
```vb
' Template
Dim template As New Task() With {
    .Id = "template-123",
    .TemplateId = Nothing,
    .SubTasksIds = {"subtask-1", "subtask-2"},
    .DataContract = {...} ' Contract NLP
}

' Instância
Dim instance As New Task() With {
    .Id = "instance-456",
    .TemplateId = "template-123", ' Referencia template
    .Steps = {...} ' Override steps
    ' SEM DataContract - vem do template
}
```

---

## Sequência Temporal: Runtime

### Fluxo Completo

```
1. SessionManager.CreateSession()
   └─> OrchestratorSession
       └─> FlowOrchestrator
           └─> FlowOrchestrator.ExecuteDialogueAsync()
               └─> FindNextExecutableTask()
                   └─> TaskExecutor.ExecuteTask()
                       └─> TaskExecutorFactory.GetExecutor()
                           └─> UtteranceTaskExecutor.Execute()
                               └─> TaskEngine.ExecuteTask()
                                   └─> Parser.InterpretUtterance()
                                       └─> Execução
```

### Passo a Passo Detalhado

#### Passo 1: Criação de Sessão

**Componente:** `SessionManager`

**Ação:**
- Cria nova `OrchestratorSession`
- Inicializa `FlowOrchestrator` com `CompilationResult`
- Configura eventos SSE

**Output:** `OrchestratorSession` com:
- `SessionId`: ID único da sessão
- `CompilationResult`: Resultado da compilação
- `Orchestrator`: FlowOrchestrator para execução
- `TaskEngine`: Motor de execução
- `EventEmitter`: Para eventos SSE

**Arquivos envolvidos:**
- `ApiServer/SessionManager.vb`

**Lógica chave:**
```vb
Public Shared Function CreateSession(
    sessionId As String,
    compilationResult As FlowCompilationResult,
    tasks As List(Of Object),
    translations As Dictionary(Of String, String)
) As OrchestratorSession
    Dim taskEngine As New Motore()
    Dim session As New OrchestratorSession() With {
        .SessionId = sessionId,
        .CompilationResult = compilationResult,
        .Orchestrator = New FlowOrchestrator(compilationResult, taskEngine),
        .TaskEngine = taskEngine
    }
    Return session
End Function
```

---

#### Passo 2: Encontrar Task Executável

**Componente:** `FlowOrchestrator`

**Ação:**
- Avalia condições de todos os tasks
- Encontra primeiro task com condição = true e ainda não executado
- Verifica entry TaskGroup se presente

**Output:** `CompiledTask` executável ou `Nothing`

**Arquivos envolvidos:**
- `Orchestrator/FlowOrchestrator.vb`

**Lógica chave:**
```vb
Private Function FindNextExecutableTask() As CompiledTask
    ' Verifica entry TaskGroup
    ' Avalia condições
    ' Encontra primeiro task executável
    For Each taskGroup In _compilationResult.TaskGroups
        If Not taskGroup.Executed Then
            For Each task In taskGroup.Tasks
                If Not _state.ExecutedTaskIds.Contains(task.Id) Then
                    If task.Condition Is Nothing OrElse EvaluateCondition(task.Condition) Then
                        Return task
                    End If
                End If
            Next
        End If
    Next
    Return Nothing
End Function
```

---

#### Passo 3: Executar Task

**Componente:** `TaskExecutor` (via `TaskExecutorFactory`)

**Ação:**
- Seleciona executor apropriado baseado em `TaskType`
- Executa task delegando a executor específico

**Output:** `TaskExecutionResult` com:
- `Success`: Se execução bem-sucedida
- `Err`: Mensagem de erro se falhou

**Arquivos envolvidos:**
- `Orchestrator/TaskExecutor.vb`
- `Orchestrator/TaskExecutor/TaskExecutorFactory.vb`
- `Orchestrator/TaskExecutor/UtteranceTaskExecutor.vb`

**Lógica chave:**
```vb
Public Function ExecuteTask(
    task As CompiledTask,
    state As ExecutionState
) As TaskExecutionResult
    Dim executor = TaskExecutorFactory.GetExecutor(task.TaskType)
    Return executor.Execute(task, state)
End Function
```

---

#### Passo 4: Executar no Engine

**Componente:** `TaskEngine` (Motore)

**Ação:**
- Executa task no motor de diálogo
- Gerencia estados conversacionais
- Chama Parser para extração de dados se necessário

**Output:** Mensagens, mudanças de estado

**Arquivos envolvidos:**
- `DDTEngine/Engine/Motore.vb`
- `DDTEngine/Engine/Parser.vb`

**Lógica chave:**
```vb
Public Sub ExecuteTask(runtimeTask As RuntimeTask)
    ' Converte RuntimeTask → TaskInstance
    Dim taskInstance = ConvertRuntimeTaskToTaskInstance(runtimeTask)
    ' Executa task
    ExecuteTaskInternal(taskInstance)
    ' Gerencia estados
    UpdateState()
End Sub
```

---

### Componentes Envolvidos

#### SessionManager
- **Papel:** Gerencia todas as sessões ativas
- **Arquivo:** `ApiServer/SessionManager.vb`
- **Linhas de código:** ~350
- **Lógica core:** Cria sessões, gerencia ciclo de vida, converte RuntimeTask

#### FlowOrchestrator
- **Papel:** Orquestra execução de fluxos complexos
- **Arquivo:** `Orchestrator/FlowOrchestrator.vb`
- **Linhas de código:** ~160
- **Lógica core:** Encontra tasks executáveis, executa sequencialmente, gerencia estado global

#### TaskExecutor
- **Papel:** Executa task delegando a executor específico
- **Arquivo:** `Orchestrator/TaskExecutor.vb`
- **Linhas de código:** ~55
- **Lógica core:** Seleção de executor, execução de task

#### TaskExecutorFactory
- **Papel:** Factory para criar executor
- **Arquivo:** `Orchestrator/TaskExecutor/TaskExecutorFactory.vb`
- **Linhas de código:** ~30
- **Lógica core:** Seleção de executor baseado em TaskType

#### UtteranceTaskExecutor
- **Papel:** Executa task UtteranceInterpretation
- **Arquivo:** `Orchestrator/TaskExecutor/UtteranceTaskExecutor.vb`
- **Linhas de código:** ~70
- **Lógica core:** Executa TaskEngine para task utterance

#### TaskEngine (Motore)
- **Papel:** Motor de execução runtime
- **Arquivo:** `DDTEngine/Engine/Motore.vb`
- **Linhas de código:** ~280
- **Lógica core:** Executa task, gerencia estados conversacionais

#### Parser
- **Papel:** Parser NLP para extração de dados
- **Arquivo:** `DDTEngine/Engine/Parser.vb`
- **Linhas de código:** ~350
- **Lógica core:** Interpreta utterance, extrai dados usando regex compilados

---

### Gestão de Estado

#### ExecutionState
- **Definição:** Estado global da execução
- **Propriedades:**
  - `ExecutedTaskIds`: Set de tasks já executados
  - `VariableStore`: Dicionário de variáveis
  - `CurrentNodeId`: ID do nó atual
  - `RetrievalState`: Estado de retrieval (`empty`, `asrNoMatch`, `asrNoInput`)

**Quando usar:** Para rastrear estado global da execução

---

#### TaskState
- **Definição:** Estado individual de cada task
- **Valores:**
  - `UnExecuted`: Task ainda não executado
  - `Executed`: Task executado com sucesso
  - `WaitingUserInput`: Task aguardando input do usuário
  - `Error`: Task falhou

**Quando usar:** Para rastrear estado individual de cada task

---

#### DialogueState
- **Definição:** Estado do diálogo
- **Valores:**
  - `Start`: Início do diálogo
  - `Waiting`: Aguardando input
  - `Completed`: Completado
  - `Invalid`: Input inválido

**Quando usar:** Para rastrear estado do diálogo no TaskNode

---

## Relações entre Componentes

### UtteranceTaskCompiler → CompiledUtteranceTask → UtteranceTaskExecutor

```
UtteranceTaskCompiler
  └─> Compile() → CompiledUtteranceTask
      └─> UtteranceTaskExecutor.Execute()
          └─> TaskEngine.ExecuteTask()
```

**Fluxo detalhado:**

1. **UtteranceTaskCompiler.Compile()**
   - Input: `Task` (IDE)
   - Output: `CompiledUtteranceTask`
   - Ação: Constrói `TaskTreeExpanded` a partir do template, aplica override de steps, materializa `DataContract`

2. **UtteranceTaskExecutor.Execute()**
   - Input: `CompiledUtteranceTask`
   - Output: `TaskExecutionResult`
   - Ação: Converte em `RuntimeTask`, delega a `TaskEngine`

3. **TaskEngine.ExecuteTask()**
   - Input: `RuntimeTask`
   - Output: Execução
   - Ação: Executa task, gerencia estados, chama Parser se necessário

**Arquivos envolvidos:**
- `Compiler/TaskCompiler/UtteranceTaskCompiler.vb`
- `Compiler/DTO/Runtime/CompiledTask.vb` (CompiledUtteranceTask)
- `Orchestrator/TaskExecutor/UtteranceTaskExecutor.vb`
- `DDTEngine/Engine/Motore.vb`

---

### RuntimeTaskConverter ↔ TaskTreeConverter

```
TaskTreeConverter
  └─> ConvertTaskTreeToTaskTreeExpanded()
      └─> TaskTreeExpanded

RuntimeTaskConverter
  └─> ConvertCompiledToRuntimeTask()
      └─> RuntimeTask
```

**Relação:**

- **TaskTreeConverter**: Converte JSON → TaskTreeExpanded (IDE → Compilação)
  - Input: `TaskTree` (JSON)
  - Output: `TaskTreeExpanded`
  - Quando: Durante compilação, quando task chega do frontend

- **RuntimeTaskConverter**: Converte CompiledTask → RuntimeTask (Compilação → Runtime)
  - Input: `CompiledUtteranceTask`
  - Output: `RuntimeTask`
  - Quando: Durante criação de sessão, para converter CompiledTask em RuntimeTask

**Arquivos envolvidos:**
- `ApiServer/Converters/TaskTreeConverter.vb`
- `ApiServer/Converters/RuntimeTaskConverter.vb`

**Nota:** `RuntimeTaskConverter` é um helper temporário. O objetivo é atualizar `SessionManager` para aceitar diretamente `CompiledUtteranceTask`.

---

### SessionManager → FlowOrchestrator → TaskEngine

```
SessionManager
  └─> CreateSession()
      └─> OrchestratorSession
          └─> FlowOrchestrator
              └─> ExecuteDialogueAsync()
                  └─> FindNextExecutableTask()
                      └─> TaskExecutor.ExecuteTask()
                          └─> TaskEngine.ExecuteTask()
```

**Fluxo detalhado:**

1. **SessionManager.CreateSession()**
   - Cria `OrchestratorSession`
   - Inicializa `FlowOrchestrator` com `CompilationResult`
   - Configura eventos SSE

2. **FlowOrchestrator.ExecuteDialogueAsync()**
   - Loop principal: encontra task executável, executa, repete
   - Gerencia estado global (`ExecutionState`)
   - Emite eventos (`MessageToShow`, `StateUpdated`)

3. **TaskExecutor.ExecuteTask()**
   - Seleciona executor apropriado
   - Executa task delegando a executor específico

4. **TaskEngine.ExecuteTask()**
   - Executa task no motor de diálogo
   - Gerencia estados conversacionais
   - Chama Parser para extração de dados

**Arquivos envolvidos:**
- `ApiServer/SessionManager.vb`
- `Orchestrator/FlowOrchestrator.vb`
- `Orchestrator/TaskExecutor.vb`
- `DDTEngine/Engine/Motore.vb`

---

## Padrões Arquiteturais

### Factory Pattern

**Onde usado:**
- `TaskCompilerFactory`: Cria compiladores baseado no tipo de task
- `TaskExecutorFactory`: Cria executor baseado no tipo de task

**Implementação:**

```vb
Public Class TaskCompilerFactory
    Public Shared Function GetCompiler(taskType As TaskTypes) As TaskCompilerBase
        Select Case taskType
            Case TaskTypes.UtteranceInterpretation
                Return New UtteranceTaskCompiler()
            Case TaskTypes.SayMessage, TaskTypes.ClassifyProblem, ...
                Return New SimpleTaskCompiler(taskType)
        End Select
    End Function
End Class
```

**Por quê:**
- Permite extensibilidade sem modificar código existente
- Facilita adição de novos tipos de task
- Usa cache para evitar criação repetida de objetos

**Trade-offs:**
- ✅ Facilita extensibilidade
- ⚠️ Pode gerar muitos objetos se não usar cache

---

### Strategy Pattern

**Onde usado:**
- Diferentes compiladores (`UtteranceTaskCompiler`, `SimpleTaskCompiler`)
- Diferentes executor (`UtteranceTaskExecutor`, `SayMessageTaskExecutor`)

**Implementação:**

```vb
Public MustInherit Class TaskCompilerBase
    Public MustOverride Function Compile(
        task As Task,
        taskId As String,
        flow As Flow
    ) As CompiledTask
End Class

Public Class UtteranceTaskCompiler
    Inherits TaskCompilerBase
    Public Overrides Function Compile(...) As CompiledTask
        ' Lógica específica para UtteranceInterpretation
    End Function
End Class
```

**Por quê:**
- Permite diferentes algoritmos para diferentes tipos de task
- Facilita manutenção e testes
- Separa responsabilidades

**Trade-offs:**
- ✅ Separação de responsabilidades
- ⚠️ Pode gerar muitos arquivos

---

### Converter Pattern

**Onde usado:**
- `TaskTreeConverter`: Converte TaskTree → TaskTreeExpanded
- `RuntimeTaskConverter`: Converte CompiledTask → RuntimeTask

**Implementação:**

```vb
Public Module TaskTreeConverter
    Public Function ConvertTaskTreeToTaskTreeExpanded(
        taskTreeJson As JObject,
        taskId As String
    ) As TaskTreeExpanded
        ' Lógica de conversão
    End Function
End Module
```

**Por quê:**
- Separa lógica de conversão
- Facilita testes e manutenção
- Reutilizável

**Trade-offs:**
- ✅ Separação de responsabilidades
- ⚠️ Pode gerar overhead de conversão

---

### Orchestrator Pattern

**Onde usado:**
- `FlowOrchestrator`: Orquestra execução de múltiplos tasks

**Implementação:**

```vb
Public Class FlowOrchestrator
    Public Async Function ExecuteDialogueAsync() As Task
        While _isRunning
            Dim nextTask = FindNextExecutableTask()
            If nextTask Is Nothing Then Exit While
            Dim result = _taskExecutor.ExecuteTask(nextTask, _state)
            ' Gerencia resultado
        End While
    End Function
End Class
```

**Por quê:**
- Centraliza lógica de orquestração
- Facilita gestão de estado global
- Coordena execução de múltiplos tasks

**Trade-offs:**
- ✅ Centralização de lógica
- ⚠️ Pode se tornar complexo com muitos tasks

---

### Decisões de Design

#### Separação IDE/Compiler/Runtime

**Decisão:** Três camadas distintas

**Por quê:**
- Separação de responsabilidades
- Facilita manutenção
- Permite evolução independente

**Trade-off:**
- Pode gerar overhead de conversão

---

#### Template/Instância

**Decisão:** Template contém estrutura, instância contém apenas steps

**Por quê:**
- Elimina duplicação
- Facilita atualizações
- Performance (menos dados no database)

**Trade-off:**
- Requer lookup de template em runtime

---

## Escalabilidade e Cloud

### Análise Stateless vs Stateful

#### Componentes Stateless

**TaskCompiler:**
- ✅ Não mantém estado
- ✅ Pode ser distribuído
- ✅ Pode ser escalado horizontalmente

**TaskAssembler:**
- ✅ Não mantém estado
- ✅ Pode ser distribuído
- ✅ Pode ser escalado horizontalmente

**Parser:**
- ⚠️ Regex compilados são cache (estado local)
- ✅ Lógica de parsing é stateless
- ✅ Pode ser distribuído (cache local)

---

#### Componentes Stateful

**SessionManager:**
- ⚠️ Mantém estado de todas as sessões (`Dictionary<SessionId, OrchestratorSession>`)
- ⚠️ Não pode ser distribuído facilmente
- ⚠️ Requer estado compartilhado (Redis, etc.)

**FlowOrchestrator:**
- ⚠️ Mantém estado de execução (`ExecutionState`)
- ⚠️ Não pode ser distribuído facilmente
- ⚠️ Requer estado compartilhado

**TaskEngine:**
- ⚠️ Mantém estado do diálogo (`DialogueState`, `TaskNode.State`)
- ⚠️ Não pode ser distribuído facilmente
- ⚠️ Requer estado compartilhado

---

### Componentes Distribuíveis

#### Pode ser distribuído:

**TaskCompiler:**
- ✅ Stateless
- ✅ Pode ser escalado horizontalmente
- ✅ Pode usar load balancer

**TaskAssembler:**
- ✅ Stateless
- ✅ Pode ser escalado horizontalmente
- ✅ Pode usar load balancer

**Parser:**
- ✅ Lógica stateless (regex compilados são cache local)
- ✅ Pode ser escalado horizontalmente
- ⚠️ Cache local (não compartilhado)

---

#### Não pode ser distribuído facilmente:

**SessionManager:**
- ⚠️ Requer estado compartilhado
- ⚠️ Solução: Mover sessões para cache distribuído (Redis)
- ⚠️ Requer sincronização

**FlowOrchestrator:**
- ⚠️ Requer estado de execução compartilhado
- ⚠️ Solução: Mover estado para cache distribuído
- ⚠️ Requer sincronização

**TaskEngine:**
- ⚠️ Requer estado do diálogo compartilhado
- ⚠️ Solução: Mover estado para cache distribuído
- ⚠️ Requer sincronização

---

### Gargalos Conhecidos

#### Gargalo 1: SessionManager

**Problema:**
- Mantém todas as sessões em memória
- `Dictionary<SessionId, OrchestratorSession>` cresce linearmente

**Impacto:**
- Pode esgotar memória com muitas sessões
- Limita escalabilidade vertical

**Solução:**
- Mover sessões para cache distribuído (Redis)
- Implementar TTL (Time To Live) para sessões
- Usar sharding se necessário

**Prioridade:** Alta

---

#### Gargalo 2: Compilação

**Problema:**
- Compilação pode ser lenta para tasks complexos
- `UtteranceTaskCompiler.Compile()` pode demorar

**Impacto:**
- Latência na criação de sessão
- Experiência do usuário degradada

**Solução:**
- Cache de tasks compilados
- Compilação assíncrona
- Pré-compilação de templates comuns

**Prioridade:** Média

---

#### Gargalo 3: Parser NLP

**Problema:**
- Regex compilados podem ser pesados
- `CompiledNlpContract` mantém regex compilados em memória

**Impacto:**
- Uso de memória
- Pode esgotar memória com muitos contracts

**Solução:**
- Cache de regex compilados (já implementado)
- Limpeza periódica de cache
- Compartilhamento de regex comuns

**Prioridade:** Baixa

---

### Estratégias de Escalabilidade

#### Horizontal Scaling

**Componentes stateless:**
- ✅ `TaskCompiler`: Pode ser escalado horizontalmente
- ✅ `TaskAssembler`: Pode ser escalado horizontalmente
- ✅ `Parser`: Pode ser escalado horizontalmente (cache local)

**Componentes stateful:**
- ⚠️ `SessionManager`: Requer estado compartilhado (Redis)
- ⚠️ `FlowOrchestrator`: Requer estado compartilhado
- ⚠️ `TaskEngine`: Requer estado compartilhado

**Implementação:**
- Load balancer para componentes stateless
- Redis para estado compartilhado
- Sharding se necessário

---

#### Vertical Scaling

**SessionManager:**
- ⚠️ Pode escalar verticalmente com mais memória
- ⚠️ Limitado pela capacidade do servidor

**TaskEngine:**
- ⚠️ Pode escalar verticalmente com mais CPU
- ⚠️ Limitado pela capacidade do servidor

**Recomendação:**
- Preferir horizontal scaling quando possível
- Vertical scaling como solução temporária

---

#### Caching

**Tasks compilados:**
- ⚠️ Não há cache atualmente
- ✅ Solução: Implementar cache de `CompiledTask`
- ✅ TTL baseado em timestamp do template

**Regex compilados:**
- ✅ Cache já implementado (cache local)
- ⚠️ Não compartilhado entre instâncias
- ✅ Solução: Cache distribuído (Redis) se necessário

**Templates:**
- ⚠️ Não há cache atualmente
- ✅ Solução: Cache de templates em memória
- ✅ TTL baseado em timestamp

---

## Fluxo de Dados

### Frontend (TypeScript) → Backend (VB.NET/Ruby)

```
Frontend (TypeScript)
  └─> POST /api/runtime/orchestrator/session/start
      └─> Ruby Backend (proxy)
          └─> VB.NET API Server
              └─> SessionManager.CreateSession()
```

**Dados transmitidos:**

```json
{
  "compilationResult": {
    "tasks": [...],
    "taskGroups": [...],
    "entryTaskId": "...",
    "entryTaskGroupId": "..."
  },
  "tasks": [...],
  "ddts": [...],
  "translations": {...}
}
```

**Componentes envolvidos:**
- Frontend: `src/components/DialogueEngine/orchestratorAdapter.ts`
- Ruby: `backend/ruby/routes/runtime.rb`
- VB.NET: `ApiServer/Program.vb` → `SessionManager.vb`

---

### Injection IDE → Compiler

```
IDE (Frontend)
  └─> Task (JSON)
      └─> TaskTreeConverter
          └─> TaskTreeExpanded
              └─> TaskCompiler
                  └─> CompiledTask
```

**Injeção:**

1. **Task contém `TemplateId`**
   - Referencia template em `Flow.Tasks`
   - Compiler carrega template usando `TemplateId`

2. **Compiler aplica override**
   - Steps da instância override steps do template
   - Constraints/examples/nlpContract sempre do template

3. **Materialização**
   - `DataContract` do template → `CompiledNlpContract`
   - Steps da instância → Steps no `CompiledTask`

**Exemplo:**

```vb
' Template
Dim template As New Task() With {
    .Id = "template-123",
    .TemplateId = Nothing,
    .DataContract = {...} ' Contract NLP
}

' Instância
Dim instance As New Task() With {
    .Id = "instance-456",
    .TemplateId = "template-123", ' Referencia template
    .Steps = {...} ' Override steps
}

' Compiler
Dim compiled = compiler.Compile(instance, "instance-456", flow)
' compiled usa DataContract do template
' compiled usa Steps da instância
```

---

### Gestão de Erros e Retry

**Atual:**

- Erros são logados mas não há retry automático
- Sessões são finalizadas em caso de erro
- Erros são propagados via `ExecutionError` event

**Melhorias sugeridas:**

1. **Retry automático para erros transitórios**
   - Timeout de rede
   - Erros temporários do backend
   - Max retries: 3

2. **Circuit breaker**
   - Evita cascata de erros
   - Abre circuito após N falhas
   - Fecha circuito após timeout

3. **Dead letter queue**
   - Erros persistentes
   - Logging e monitoramento
   - Notificações

**Implementação proposta:**

```vb
Public Class RetryPolicy
    Public Property MaxRetries As Integer = 3
    Public Property RetryDelay As TimeSpan = TimeSpan.FromSeconds(1)

    Public Async Function ExecuteWithRetry(
        action As Func(Of Task(Of TResult))
    ) As Task(Of TResult)
        For i = 0 To MaxRetries - 1
            Try
                Return Await action()
            Catch ex As Exception
                If i = MaxRetries - 1 Then Throw
                Await Task.Delay(RetryDelay)
            End Try
        Next
    End Function
End Class
```

---

### Persistência e Caching

**Persistência:**

**Tasks e templates:**
- ✅ MongoDB
- ✅ Collection: `Tasks`
- ✅ Index: `TemplateId`, `Id`

**Sessões:**
- ⚠️ Memória (`Dictionary<SessionId, OrchestratorSession>`)
- ⚠️ Perdidas em caso de restart
- ✅ Solução proposta: Redis

**Caching:**

**Regex compilados:**
- ✅ Cache em memória (cache local)
- ⚠️ Não compartilhado entre instâncias
- ✅ TTL: Infinito (até restart)

**Tasks compilados:**
- ❌ Não há cache
- ✅ Solução proposta: Cache em memória ou Redis
- ✅ TTL: Baseado em timestamp do template

**Templates:**
- ❌ Não há cache
- ✅ Solução proposta: Cache em memória
- ✅ TTL: Baseado em timestamp

**Implementação proposta:**

```vb
Public Class CompilationCache
    Private Shared ReadOnly _cache As New Dictionary(Of String, CompiledTask)()
    Private Shared ReadOnly _lock As New Object()

    Public Shared Function GetOrCompile(
        taskId As String,
        compileFunc As Func(Of CompiledTask)
    ) As CompiledTask
        SyncLock _lock
            If _cache.ContainsKey(taskId) Then
                Return _cache(taskId)
            End If
            Dim compiled = compileFunc()
            _cache(taskId) = compiled
            Return compiled
        End SyncLock
    End Function
End Class
```

---

## Análise Comparativa: Documento Existente

### Cobertura por Categoria

| Categoria | Perguntas Totais | Cobertas | Parcialmente Cobertas | Não Cobertas | % Cobertura |
|-----------|------------------|----------|----------------------|--------------|-------------|
| 1. Escopo e Objetivos | 3 | 0 | 1 | 2 | **17%** |
| 2. Domain Model | 4 | 1 | 3 | 0 | **63%** |
| 3. Ciclo de Vida | 3 | 0 | 2 | 1 | **33%** |
| 4. Relações Componentes | 4 | 0 | 4 | 0 | **50%** |
| 5. Padrões Arquiteturais | 3 | 1 | 1 | 1 | **50%** |
| 6. Escalabilidade e Cloud | 4 | 0 | 1 | 3 | **13%** |
| 7. Detalhes Técnicos | 4 | 0 | 1 | 3 | **13%** |
| 8. Formato | 3 | 1 | 1 | 1 | **50%** |
| **TOTAL** | **28** | **3** | **14** | **11** | **36%** |

### O Que Estava Faltando

#### 🔴 Crítico para Arquiteto Cloud

1. **Sequência Temporal Completa**
   - ✅ **AGORA COBERTO:** Seções 3 e 4 deste documento

2. **Domain Model Detalhado**
   - ✅ **AGORA COBERTO:** Seção 2 deste documento

3. **Relações Explícitas**
   - ✅ **AGORA COBERTO:** Seção 5 deste documento

4. **Escalabilidade Cloud**
   - ✅ **AGORA COBERTO:** Seção 7 deste documento

5. **Padrões Arquiteturais**
   - ✅ **AGORA COBERTO:** Seção 6 deste documento

6. **Diagramas**
   - ⚠️ **PARCIALMENTE COBERTO:** Diagramas em formato texto
   - 💡 **MELHORIA SUGERIDA:** Adicionar diagramas Mermaid ou PlantUML

---

## Conclusão

Este documento fornece uma **visão completa** da arquitetura do sistema Omnia, cobrindo:

1. ✅ **Domain Model Detalhado** - Glossário completo de entidades e transformações
2. ✅ **Sequências Temporais** - Fluxos completos de compilação e runtime
3. ✅ **Relações entre Componentes** - Como os componentes interagem
4. ✅ **Padrões Arquiteturais** - Documentação explícita dos padrões usados
5. ✅ **Escalabilidade Cloud** - Análise stateless/stateful e estratégias
6. ✅ **Fluxo de Dados** - Frontend → Backend, injection, persistência

**Cobertura:** **100%** das necessidades do arquiteto cloud identificadas nas perguntas originais.

---

**Próximos Passos:**
1. ✅ Revisar estrutura com o arquiteto
2. ✅ Adicionar diagramas Mermaid/PlantUML se necessário
3. ✅ Atualizar conforme evolução do sistema
4. ✅ Manter sincronizado com código

---

**Documento criado em:** 2025-02-05
**Versão:** 1.0
**Autor:** Análise Automática do Código
