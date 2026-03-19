// Hook to get compilation errors for a specific nodevai
// Uses error index for performance

import { useMemo } from 'react';
import type { CompilationError } from '../../FlowCompiler/types';
import type { NodeRowData } from '../../../types/project';
import { normalizeSeverity } from '../../../utils/severityUtils';

export interface NodeErrorsResult {
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
      // Match by nodeId (priorità massima)
      if (e.nodeId === nodeId) {
        return true;
      }

      // Match by taskId or rowId in rows
      return rows.some(row => {
        const taskId = (row as any).taskId || row.id;
        return e.taskId === taskId || e.rowId === row.id;
      });
    });

    if (nodeErrors.length === 0) {
      return {
        hasError: false,
        hasWarning: false,
        errors: [],
        borderColor: 'transparent',
        borderWidth: 1
      };
    }

    // ✅ Calculate severity - only 'error' and 'warning' are handled
    // 'hint' is defined in the type but not used yet (future design suggestions)
    // ✅ Normalize severity: backend sends "Error"/"Warning" (PascalCase), frontend expects 'error'/'warning' (lowercase)
    const hasError = nodeErrors.some(e => normalizeSeverity(e.severity) === 'error');
    const hasWarning = nodeErrors.some(e => normalizeSeverity(e.severity) === 'warning');

    // ✅ Determine border color and width
    let borderColor = 'transparent';
    let borderWidth = 1;

    if (hasError) {
      borderColor = '#ef4444'; // red-500
      borderWidth = 3;
    } else if (hasWarning) {
      borderColor = '#f59e0b'; // orange
      borderWidth = 2;
    }
    // Note: 'hint' severity is ignored for now (future use)

    return {
      hasError,
      hasWarning,
      errors: nodeErrors,
      borderColor,
      borderWidth
    };
  }, [nodeId, rows, errors]);
}
