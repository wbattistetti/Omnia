// Hook to get compilation errors for a specific row
import { useMemo } from 'react';
import type { CompilationError } from '../../FlowCompiler/types';
import { normalizeSeverity } from '../../../utils/severityUtils';

export interface RowErrorsResult {
  hasError: boolean;
  hasWarning: boolean;
  errors: CompilationError[];
  borderColor: string;
  borderWidth: number;
  backgroundColor: string; // ✅ NEW: Background color for row with 50% transparency
}

/**
 * Hook to get compilation errors for a specific row
 * Filters errors by rowId and taskId
 */
export function useRowErrors(
  rowId: string,
  taskId: string | undefined,
  errors: CompilationError[]
): RowErrorsResult {
  return useMemo(() => {
    // Filter errors for this row
    const rowErrors = errors.filter(e => {
      return e.rowId === rowId || (taskId && e.taskId === taskId);
    });

    if (rowErrors.length === 0) {
      return {
        hasError: false,
        hasWarning: false,
        errors: [],
        borderColor: 'transparent',
        borderWidth: 0,
        backgroundColor: 'transparent' // Default transparent
      };
    }

    // Calculate severity - only 'error' and 'warning' are handled
    const hasError = rowErrors.some(e => normalizeSeverity(e.severity) === 'error');
    const hasWarning = rowErrors.some(e => normalizeSeverity(e.severity) === 'warning');

    // Determine border color and width
    let borderColor = 'transparent';
    let borderWidth = 0;
    let backgroundColor = 'transparent';

    if (hasError) {
      borderColor = '#ef4444'; // red-500
      borderWidth = 2;
      backgroundColor = 'rgba(239, 68, 68, 0.2)'; // red-500 with 20% transparency
    } else if (hasWarning) {
      borderColor = '#f59e0b'; // orange
      borderWidth = 1;
      backgroundColor = 'rgba(245, 158, 11, 0.2)'; // orange-500 with 20% transparency
    }

    return {
      hasError,
      hasWarning,
      errors: rowErrors,
      borderColor,
      borderWidth,
      backgroundColor
    };
  }, [rowId, taskId, errors]);
}
