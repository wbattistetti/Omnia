// Execution Highlight Constants
// Single source of truth for all execution highlighting colors and styles
// Future: Can be moved to a config panel for user customization

/**
 * Step colors for DDT execution states
 * These are independent constants, not tied to stepMeta
 */
export const StepColor = {
  Normal: '#3b82f6',    // Blue - for stepStart
  Match: '#22c55e',     // Green - for stepMatch (success)
  NoMatch: '#ef4444'    // Red - for stepNoMatch
} as const;

/**
 * Highlight configuration for flowchart nodes during execution
 * Using borders only (no background) for visual feedback
 */
export const Highlight = {
  FlowNode: {
    executingBorderWidth: 4,  // ✅ Bordo 4px quando nodo in esecuzione
    executedBorderWidth: 2,   // ✅ Bordo 2px quando nodo eseguito
    borderColor: '#22c55e'     // ✅ Verde per tutti i bordi
  },
  FlowNodeRow: {
    executingBorderWidth: 4,  // ✅ Bordo 4px quando riga in esecuzione
    executedBorderWidth: 2,   // ✅ Bordo 2px quando riga eseguita
    borderColor: '#22c55e'    // ✅ Verde per tutti i bordi
  },
  Edge: {
    validCondition: '#22c55e',             // Green - link with condition=true
    multipleValidError: '#ef4444'         // Red - multiple links with condition=true (logical error)
  }
} as const;

/**
 * Helper to convert hex color to rgba with opacity
 */
export function hexToRgba(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${opacity})`;
}

