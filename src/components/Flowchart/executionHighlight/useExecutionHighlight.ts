// Hook for calculating execution highlight styles
import { useMemo } from 'react';
import { useExecutionState } from './ExecutionStateContext';
import { Highlight, StepColor } from './executionHighlightConstants';
import type { NodeRowData } from '../../../types/project';

export interface ExecutionHighlightStyles {
  nodeBorder: string;
  nodeBorderWidth: number;
  // ✅ RIMOSSO: nodeBackground e rowBackground - usiamo solo bordi
}

/**
 * Hook to get execution highlight styles for a node
 * Returns only border styles (no background)
 */
export function useNodeExecutionHighlight(nodeId: string, rows: NodeRowData[]): ExecutionHighlightStyles {
  const execState = useExecutionState();

  return useMemo(() => {
    if (!execState || !execState.isRunning) {
      return {
        nodeBorder: 'transparent',
        nodeBorderWidth: 1
      };
    }

    const isExecuting = execState.isNodeExecuting(nodeId);
    const hasExecutedRows = rows.some(row => {
      const taskId = (row as any).taskId || row.id;
      return execState.isTaskExecuted(taskId);
    });

    // ✅ Node in esecuzione: bordo con colore dello step della riga in esecuzione (4px)
    if (isExecuting) {
      // Trova la riga in esecuzione e ottieni il suo stepType
      const executingRow = rows.find(row => {
        return execState.isRowExecuting(row.id);
      });

      let stepType: 'stepStart' | 'stepMatch' | 'stepNoMatch' | null = null;
      if (executingRow) {
        stepType = execState.getRowStepType(executingRow.id);
      }

      // Mappa stepType ai colori StepColor (come per le righe)
      let borderColor: string;
      switch (stepType) {
        case 'stepStart':
          borderColor = StepColor.Normal; // Blu
          break;
        case 'stepMatch':
          borderColor = StepColor.Match; // Verde
          break;
        case 'stepNoMatch':
          borderColor = StepColor.NoMatch; // Rosso
          break;
        default:
          borderColor = StepColor.Normal; // Default blu
      }

      return {
        nodeBorder: borderColor,
        nodeBorderWidth: Highlight.FlowNode.executingBorderWidth
      };
    }

    // ✅ Node eseguito: bordo verde 2px
    if (hasExecutedRows) {
      return {
        nodeBorder: Highlight.FlowNode.borderColor,
        nodeBorderWidth: Highlight.FlowNode.executedBorderWidth
      };
    }

    return {
      nodeBorder: 'transparent',
      nodeBorderWidth: 1
    };
  }, [execState, nodeId, rows]);
}

/**
 * Hook to get execution highlight styles for a row
 * Returns only border styles (no background)
 */
export function useRowExecutionHighlight(rowId: string, taskId?: string): {
  border: string;
  borderWidth: number;
  stepType: 'stepStart' | 'stepMatch' | 'stepNoMatch' | null;
} {
  const execState = useExecutionState();

  return useMemo(() => {
    if (!execState || !execState.isRunning) {
      return { border: 'transparent', borderWidth: 0, stepType: null };
    }

    const isExecuting = execState.isRowExecuting(rowId);
    const isExecuted = taskId ? execState.isTaskExecuted(taskId) : false;
    const stepType = execState.getRowStepType(rowId);

    // ✅ Riga in esecuzione: bordo con colore dello step corrente (4px)
    if (isExecuting) {
      const currentStepType = stepType || 'stepStart';

      // Mappa stepType ai colori StepColor
      let borderColor: string;
      switch (currentStepType) {
        case 'stepStart':
          borderColor = StepColor.Normal; // Blu
          break;
        case 'stepMatch':
          borderColor = StepColor.Match; // Verde
          break;
        case 'stepNoMatch':
          borderColor = StepColor.NoMatch; // Rosso
          break;
        default:
          borderColor = StepColor.Normal; // Default blu
      }

      return {
        border: borderColor,
        borderWidth: Highlight.FlowNodeRow.executingBorderWidth,
        stepType: currentStepType
      };
    }

    // ✅ Riga eseguita: bordo verde 2px
    if (isExecuted) {
      return {
        border: Highlight.FlowNodeRow.borderColor,
        borderWidth: Highlight.FlowNodeRow.executedBorderWidth,
        stepType: null
      };
    }

    return { border: 'transparent', borderWidth: 0, stepType: null };
  }, [execState, rowId, taskId]);
}

