// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useMemo } from 'react';
import { useRowExecutionHighlight } from '@components/Flowchart/executionHighlight/useExecutionHighlight';
import { getTaskIdFromRow } from '@utils/taskHelpers';
import type { Row } from '@types/NodeRowTypes';
import { useRowErrors } from '../../../hooks/useRowErrors';
import { useCompilationErrors } from '../../../../../context/CompilationErrorsContext';

export type VisualState = 'normal' | 'fade' | 'highlight';

export interface UseNodeRowStylesProps {
  row: Row;
  visualState: VisualState;
  included: boolean;
  isPlaceholder: boolean;
  isBeingDragged: boolean;
  style?: React.CSSProperties;
}

export interface UseNodeRowStylesResult {
  conditionalStyles: React.CSSProperties;
  conditionalClasses: string;
  checkboxStyles: React.CSSProperties;
  finalStyles: React.CSSProperties;
  rowBorderStyle: React.CSSProperties;
  rowBackgroundStyle: React.CSSProperties; // ✅ NEW: Background for compilation errors
}

/**
 * Custom hook that encapsulates all style calculation logic for a NodeRow.
 * This significantly reduces the size of the main component by extracting style computation.
 */
export function useNodeRowStyles(props: UseNodeRowStylesProps): UseNodeRowStylesResult {
  const { row, visualState, included, isPlaceholder, isBeingDragged, style } = props;

  // Get execution highlight styles for row
  // Task may not exist yet (created only when ResponseEditor is opened)
  const taskId = getTaskIdFromRow(row);
  const rowHighlight = useRowExecutionHighlight(row.id, taskId || undefined);

  // ✅ COMPILATION ERRORS: Get errors for this row
  const { errors: compilationErrors } = useCompilationErrors();
  const rowErrors = useRowErrors(row.id, taskId || undefined, compilationErrors);

  return useMemo(() => {
    // Visual state styles
    const getVisualStyles = (): React.CSSProperties => {
      switch (visualState) {
        case 'fade':
          return { opacity: 0.3, transition: 'opacity 0.2s ease' };
        case 'highlight':
          return {
            backgroundColor: 'rgba(16, 185, 129, 0.6)', // Green emerald-500 with transparency
            borderRadius: '8px',
            // No border, no transition to avoid "white before green" effect
            // Must start green immediately without transition effects
          };
        default:
          return {};
      }
    };

    // Checkbox visual effect: always grey when unchecked
    const getCheckboxStyles = (): React.CSSProperties => {
      if (!included) {
        return {
          opacity: 0.5,
          transition: 'opacity 0.2s ease'
        };
      }
      return {};
    };

    // Conditional styles
    let conditionalStyles: React.CSSProperties = {};
    let conditionalClasses = '';

    if (isPlaceholder) {
      conditionalStyles = {
        display: 'none'
      };
    } else if (isBeingDragged) {
      conditionalStyles = {
        ...style,
        position: 'relative',
        zIndex: 0,
        opacity: 1,
        boxShadow: 'none',
        backgroundColor: 'transparent',
        outline: '1px dashed #94a3b8',
        outlineOffset: 2,
        pointerEvents: 'auto'
      };
    }

    // Merge visual styles with conditional styles
    conditionalStyles = { ...conditionalStyles, ...getVisualStyles() };

    // Checkbox styles (always applied based on included state)
    const checkboxStyles = getCheckboxStyles();

    // Final styles that preserve highlight but apply defaults
    const finalStyles = visualState === 'highlight'
      ? {} // Don't override highlight styles
      : {
        backgroundColor: 'transparent',
        border: 'none',
        outline: 'none',
        boxShadow: 'none',
        paddingLeft: 0,
        paddingRight: 0,
        marginTop: 0,
        marginBottom: 0,
        paddingTop: 4,
        paddingBottom: 4,
        minHeight: 0,
        height: 'auto',
        width: '100%'
      };

    // ✅ Apply border and background for compilation errors (priority over execution highlight)
    // Priority: Compilation error > Execution highlight
    const compilationErrorBorder = rowErrors.borderColor !== 'transparent'
      ? {
          border: `${rowErrors.borderWidth}px solid ${rowErrors.borderColor}`,
          borderRadius: '4px'
        }
      : {};

    // ✅ Apply background color with 20% transparency for compilation errors
    const compilationErrorBackground = rowErrors.backgroundColor !== 'transparent'
      ? {
          backgroundColor: rowErrors.backgroundColor
        }
      : {};

    // Apply border instead of background (execution highlight)
    const rowBorderStyle = compilationErrorBorder.border
      ? compilationErrorBorder
      : (rowHighlight.border !== 'transparent'
          ? {
              border: `${rowHighlight.borderWidth}px solid ${rowHighlight.border}`,
              borderRadius: '4px'
            }
          : {});

    // Merge background with final styles
    const finalStylesWithBackground = {
      ...finalStyles,
      ...compilationErrorBackground
    };

    return {
      conditionalStyles,
      conditionalClasses,
      checkboxStyles,
      finalStyles: finalStylesWithBackground,
      rowBorderStyle,
      rowBackgroundStyle: compilationErrorBackground,
    };
  }, [visualState, included, isPlaceholder, isBeingDragged, style, rowHighlight, rowErrors]);
}
