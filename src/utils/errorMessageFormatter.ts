// Error message formatter for compilation errors
// Formats errors into user-friendly messages for chat display

import type { CompilationError } from '../components/FlowCompiler/types';
import { normalizeSeverity } from './severityUtils';

const MAX_BULLET_LINES = 18;
const MAX_MESSAGE_CHARS = 300;

function clipMessage(text: string, maxChars: number): string {
  const t = text.trim();
  if (t.length <= maxChars) return t;
  return `${t.slice(0, maxChars)}…`;
}

/** Testo utente per una singola voce (message ha priorità su code). */
export function primaryCompilationErrorLine(e: CompilationError): string {
  const m = (e.message || '').trim();
  if (m) return m;
  const c = (e.code || '').trim();
  if (c) return c;
  return 'Errore di compilazione';
}

/**
 * Una bolla chat per singolo errore di compilazione (più backend ⇒ più bolle).
 */
export function formatCompilationErrorChatBubble(
  error: CompilationError,
  index: number,
  total: number
): string {
  const detail = clipMessage(primaryCompilationErrorLine(error), MAX_MESSAGE_CHARS);
  if (total <= 1) {
    return `⚠️ Il dialogo non può partire.\n\n${detail}`;
  }
  return `⚠️ Errore ${index + 1} di ${total}\n\n${detail}`;
}

/**
 * Messaggio aggregato legacy (test / contesti senza bolle multiple).
 */
export function formatCompilationErrorMessage(errors: CompilationError[]): string {
  const blocking = errors.filter((e) => normalizeSeverity(e.severity) === 'error');
  const n = blocking.length;

  const head =
    n === 0
      ? '⚠️ Il dialogo non può partire (nessun dettaglio errore).\n\n'
      : n === 1
        ? '⚠️ Il dialogo non può partire: c’è 1 errore.\n\n'
        : `⚠️ Il dialogo non può partire: ci sono ${n} errori.\n\n`;

  if (n === 0) {
    return `${head}Usa il debugger del flusso (Run) per dettagli e Fix.`;
  }

  const bullets: string[] = [];
  let truncated = false;
  const seen = new Set<string>();

  for (let i = 0; i < blocking.length; i++) {
    const e = blocking[i];
    if (bullets.length >= MAX_BULLET_LINES) {
      truncated = true;
      break;
    }
    const line = clipMessage(primaryCompilationErrorLine(e), MAX_MESSAGE_CHARS);
    const dedupeKey = line.toLowerCase().replace(/\s+/g, ' ').trim();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    bullets.push(`• ${line}`);
  }

  const detail =
    bullets.length > 0
      ? `${bullets.join('\n')}${truncated ? '\n… altre voci nel debugger (Run).' : ''}`
      : 'Controlla il flowchart o il debugger del flusso (Run).';

  return `${head}${detail}`;
}

/**
 * Formats compilation warnings into an informational message
 */
export function formatCompilationWarningMessage(errors: CompilationError[]): string | null {
  const warningCount = errors.filter((e) => normalizeSeverity(e.severity) === 'warning').length;

  if (warningCount > 0) {
    return (
      `ℹ️ Il dialogo può partire, ma ci sono ${warningCount} avvisi. ` +
      `Controlla gli avvisi nel flowchart per migliorare il dialogo.`
    );
  }

  return null;
}
