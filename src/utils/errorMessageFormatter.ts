// Error message formatter for compilation errors
// Formats errors into user-friendly messages for chat display

import type { CompilationError } from '../components/FlowCompiler/types';

/**
 * Formats compilation errors into a user-friendly message for chat display
 */
export function formatCompilationErrorMessage(errors: CompilationError[]): string {
  const criticalCount = errors.filter(e => e.severity === 'critical').length;
  const errorCount = errors.filter(e => e.severity === 'error').length;

  if (criticalCount > 0 && errorCount > 0) {
    return `⚠️ Il dialogo non può partire: ci sono ${criticalCount} errori critici e ${errorCount} errori. ` +
           `Controlla gli errori nel flowchart e correggili prima di eseguire il dialogo.`;
  } else if (criticalCount > 0) {
    return `⚠️ Il dialogo non può partire: ci sono ${criticalCount} errori critici. ` +
           `Controlla gli errori nel flowchart e correggili prima di eseguire il dialogo.`;
  } else {
    return `⚠️ Il dialogo non può partire: ci sono ${errorCount} errori. ` +
           `Controlla gli errori nel flowchart e correggili prima di eseguire il dialogo.`;
  }
}

/**
 * Formats compilation warnings into an informational message
 */
export function formatCompilationWarningMessage(errors: CompilationError[]): string | null {
  const warningCount = errors.filter(e => e.severity === 'warning').length;

  if (warningCount > 0) {
    return `ℹ️ Il dialogo può partire, ma ci sono ${warningCount} avvisi. ` +
           `Controlla gli avvisi nel flowchart per migliorare il dialogo.`;
  }

  return null;
}
