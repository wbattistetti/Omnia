/**
 * Strato D: navigazione verso editor (intent chiuso + esecuzione centralizzata).
 */

import type { CompilationError } from '@components/FlowCompiler/types';
import { runCompilationErrorFix } from '@utils/compilationErrorFix';

/**
 * Estendibile senza modificare gli handler esistenti: nuovi kind = nuovi branch in executeNavigationIntent.
 */
export type NavigationIntent =
  | {
      /** Delega al pipeline Fix esistente (task editor, condition editor, canvas). */
      kind: 'compilationFix';
      error: CompilationError;
    };

/**
 * Risolve l’intent di navigazione per un errore di compilazione arricchito.
 * Oggi tutti i casi delegano a `runCompilationErrorFix`; in futuro: tabella key → intent esplicito.
 */
export function resolveNavigationIntent(error: CompilationError): NavigationIntent {
  return { kind: 'compilationFix', error };
}

/**
 * Esegue l’intent (eventi DOM / servizi già usati dal flowchart).
 */
export async function executeNavigationIntent(intent: NavigationIntent): Promise<void> {
  if (intent.kind === 'compilationFix') {
    await runCompilationErrorFix(intent.error);
  }
}

/** Alias naming aligned with architecture docs (“resolve navigation from error”). */
export function resolveCompilationNavigation(error: CompilationError): NavigationIntent {
  return resolveNavigationIntent(error);
}
