// Hook to get compilation errors for a specific edge
// Filters errors by edgeId

import { useMemo } from 'react';
import type { CompilationError } from '../../FlowCompiler/types';
import { normalizeSeverity } from '../../../utils/severityUtils';

export interface EdgeErrorsResult {
  hasError: boolean;
  hasWarning: boolean;
  errors: CompilationError[];
  strokeColor: string;
  strokeWidth: number;
}

/**
 * Hook to get compilation errors for a specific edge
 * Filters errors by edgeId
 */
export function useEdgeErrors(
  edgeId: string,
  errors: CompilationError[]
): EdgeErrorsResult {
  return useMemo(() => {
    // Filter errors for this edge
    const edgeErrors = errors.filter(e => e.edgeId === edgeId);

    if (edgeErrors.length === 0) {
      return {
        hasError: false,
        hasWarning: false,
        errors: [],
        strokeColor: 'transparent',
        strokeWidth: 2
      };
    }

    // ✅ Calculate severity - only 'error' and 'warning' are handled
    // 'hint' is defined in the type but not used yet (future design suggestions)
    // ✅ Normalize severity: backend sends "Error"/"Warning" (PascalCase), frontend expects 'error'/'warning' (lowercase)
    const hasError = edgeErrors.some(e => normalizeSeverity(e.severity) === 'error');
    const hasWarning = edgeErrors.some(e => normalizeSeverity(e.severity) === 'warning');

    // ✅ Determine stroke color and width
    let strokeColor = 'transparent';
    let strokeWidth = 2;

    if (hasError) {
      strokeColor = '#ef4444'; // red-500
      strokeWidth = 4;
    } else if (hasWarning) {
      strokeColor = '#f59e0b'; // orange
      strokeWidth = 3;
    }
    // Note: 'hint' severity is ignored for now (future use)

    return {
      hasError,
      hasWarning,
      errors: edgeErrors,
      strokeColor,
      strokeWidth
    };
  }, [edgeId, errors]);
}
