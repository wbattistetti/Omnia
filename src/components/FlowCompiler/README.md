# Flow Compiler

Compilatore che trasforma flowchart + DDT in lista piatta di Task con condizioni.

## Architettura

### Compilatore
- **Input**: Flowchart (nodi/archi) + DDT nested
- **Output**: Lista piatta di `CompiledTask` con condizioni esplicite

### Motore
- **Input**: Lista piatta di Task
- **Logica**: Loop semplice che trova task eseguibili e li esegue

## Uso

```typescript
import { compileFlow } from './FlowCompiler';
import { DialogueEngine } from './DialogueEngine';

// 1. Compila flowchart
const result = compileFlow(nodes, edges, {
  getTask: (taskId) => taskRepository.getTask(taskId),
  getDDT: (taskId) => ddtRepository.getDDT(taskId)
});

// 2. Crea motore
const engine = new DialogueEngine(result, {
  onTaskExecute: async (task) => {
    // Esegui task
    switch (task.action) {
      case 'SayMessage':
        return await sendMessage(task.value.text);
      case 'GetData':
        return await startDataCollection(task.value.ddt);
      // ...
    }
  },
  onComplete: () => {
    console.log('Flow completed');
  }
});

// 3. Avvia esecuzione
await engine.start();
```

## Condizioni

### Sequenze (righe, actions)
```typescript
{ type: 'TaskState', taskId: 'task-precedente', state: 'Executed' }
```

### Step DDT
```typescript
{ type: 'RetrievalState', state: 'empty' | 'asrNoMatch' | 'asrNoInput' }
```

### Prima riga nodo
- Entry node: `null` (sempre eseguibile)
- Con parent: `{ type: 'And', conditions: [TaskState + EdgeCondition per ogni parent] }`

## Struttura Task

```typescript
interface CompiledTask {
  id: string;
  taskId: string;
  action: string;
  value: Record<string, any>;
  condition: Condition | null;
  state: 'UnExecuted' | 'Executed';
  source: {
    type: 'flowchart' | 'ddt-step' | 'ddt-recovery-action';
    nodeId?: string;
    rowId?: string;
    stepType?: string;
    recoveryId?: string;
    actionId?: string;
  };
}
```

