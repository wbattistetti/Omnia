// Hook to get compilation errors for a specific node
// Uses error index for performance

import { useMemo } from 'react';
import type { CompilationError } from '../../FlowCompiler/types';
import type { NodeRowData } from '../../../types/project';

export interface NodeErrorsResult {
  hasCritical: boolean;
  hasError: boolean;
  hasWarning: boolean;
  errors: CompilationError[];
  borderColor: string;
  borderWidth: number;
}

/**
 * Hook to get compilation errors for a specific node
 * Filters errors by nodeId, taskId, and rowId
 */
export function useNodeErrors(
  nodeId: string,
  rows: NodeRowData[],
  errors: CompilationError[]
): NodeErrorsResult {
  return useMemo(() => {
    // Filter errors for this node
    const nodeErrors = errors.filter(e => {
      // Match by nodeId
      if (e.nodeId === nodeId) return true;

      // Match by taskId or rowId in rows
      return rows.some(row => {
        const taskId = (row as any).taskId || row.id;
        return e.taskId === taskId || e.rowId === row.id;
      });
    });

    if (nodeErrors.length === 0) {
      return {
        hasCritical: false,
        hasError: false,
        hasWarning: false,
        errors: [],
        borderColor: 'transparent',
        borderWidth: 1
      };
    }

    // Calculate severity
    const hasCritical = nodeErrors.some(e => e.severity === 'critical');
    const hasError = nodeErrors.some(e => e.severity === 'error');
    const hasWarning = nodeErrors.some(e => e.severity === 'warning');

    // Determine border color and width
    let borderColor = 'transparent';
    let borderWidth = 1;

    if (hasCritical) {
      borderColor = '#991b1b'; // red-900 (dark red)
      borderWidth = 3;
    } else if (hasError) {
      borderColor = '#ef4444'; // red-500
      borderWidth = 3;
    } else if (hasWarning) {
      borderColor = '#f59e0b'; // yellow-500
      borderWidth = 2;
    }

    return {
      hasCritical,
      hasError,
      hasWarning,
      errors: nodeErrors,
      borderColor,
      borderWidth
    };
  }, [nodeId, rows, errors]);
}
