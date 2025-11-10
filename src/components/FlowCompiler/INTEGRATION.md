# Integrazione Flow Compiler

## Stato Integrazione

Il nuovo compilatore e motore di dialogo sono stati implementati e sono pronti per l'integrazione.

### Componenti Creati

1. **FlowCompiler/** - Compilatore che trasforma flowchart + DDT in lista piatta di Task
2. **DialogueEngine/** - Motore semplice che esegue task in base alle condizioni
3. **useNewFlowOrchestrator** - Hook React che integra compilatore + motore

### Come Abilitare

Per abilitare il nuovo orchestrator, imposta il flag in localStorage:

```javascript
localStorage.setItem('feature.newFlowOrchestrator', '1');
```

### Prossimi Passi

1. **Completare integrazione in DDEBubbleChat**
   - Collegare callback per messaggi
   - Collegare callback per DDT
   - Gestire completamento DDT

2. **Implementare executor mancanti**
   - BackendCall executor
   - ProblemClassification executor
   - AIAgent executor

3. **Testare con flowchart reale**
   - Verificare compilazione
   - Verificare esecuzione
   - Verificare condizioni

4. **Sostituire vecchio orchestrator**
   - Rimuovere vecchio useFlowOrchestrator
   - Rimuovere DialogueDataEngine vecchio
   - Pulire codice legacy

### API del Nuovo Orchestrator

Il nuovo orchestrator mantiene la stessa API del vecchio per backward compatibility:

```typescript
{
  // State
  currentNodeId: string | null;
  currentActIndex: number;
  isRunning: boolean;
  currentDDT: AssembledDDT | null;
  activeContext: { blockName: string; actName: string } | null;
  variableStore: Record<string, any>;
  error: string | null;

  // Actions
  start: () => void;
  stop: () => void;
  nextAct: () => void;
  getCurrentNode: () => Node | undefined;
  drainSequentialNonInteractiveFrom: (index: number) => {...};
  drainInitialMessages: () => {...};
  updateVariableStore: (updater: Function) => void;
  setCurrentDDT: (ddt: AssembledDDT | null) => void;
  updateCurrentActIndex: (index: number) => void;
  onDDTCompleted: () => void;
}
```

### Differenze Chiave

1. **Compilazione una volta**: Il flowchart viene compilato in lista piatta di task all'inizio
2. **Condizioni esplicite**: Ogni task ha una condizione chiara e valutabile
3. **Esecuzione semplice**: Loop che trova task eseguibili e li esegue
4. **DDT espanso**: I DDT vengono espansi in task durante la compilazione

