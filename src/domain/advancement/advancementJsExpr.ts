/**
 * Valutazione espressioni JavaScript per avanzamento SEND (Test designer + apply batch).
 * Contesto: solo `param` e `prev` come parametri della funzione (oggetti literal congelati).
 * Le espressioni sono authoring interno: non è una sandbox anti-malware completa.
 */

export class AdvancementJsExprError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AdvancementJsExprError';
  }
}

/** Messaggio motore: assegnazione a livello radice (prompt IA). */
export const ADVANCEMENT_ASSIGNMENT_SYNTAX_MESSAGE = "Non usare =; scrivi solo l'espressione.";

/**
 * Messaggio motore: arrow function senza invocazione al livello radice (es. `() => { ... }`).
 * Usare IIFE: `( () => { ... } )()`.
 */
export const ADVANCEMENT_BARE_ARROW_SYNTAX_MESSAGE =
  'Non usare () => { ... }; usa (() => { ... })().';

/** Blocca forma assegnazione semplice `nome = ...` all'inizio (come da prompt IA). */
export function rejectAdvancementAssignmentSyntax(source: string): void {
  const s = source.trim();
  if (/^\s*[A-Za-z_$][\w$]*\s*=(?!=)/.test(s)) {
    throw new AdvancementJsExprError(ADVANCEMENT_ASSIGNMENT_SYNTAX_MESSAGE);
  }
}

/**
 * Blocca arrow `() => …` come forma radice senza invocazione (restituirebbe una Function al runtime).
 */
export function rejectBareRootArrowFunctionSyntax(source: string): void {
  const s = source.trim();
  if (/^\s*\(\s*\)\s*=>/.test(s)) {
    throw new AdvancementJsExprError(ADVANCEMENT_BARE_ARROW_SYNTAX_MESSAGE);
  }
}

function stripTrailingSemicolons(source: string): string {
  let b = source.trim();
  while (b.endsWith(';')) {
    b = b.slice(0, -1).trim();
  }
  return b;
}

function compileAdvancementExprFn(source: string): (param: Record<string, unknown>, prev: Record<string, unknown>) => unknown {
  rejectAdvancementAssignmentSyntax(source);
  rejectBareRootArrowFunctionSyntax(source);
  const body = stripTrailingSemicolons(source);
  if (!body) {
    throw new AdvancementJsExprError('Espressione vuota.');
  }
  try {
    return new Function(
      'param',
      'prev',
      `"use strict"; return (${body});`
    ) as (param: Record<string, unknown>, prev: Record<string, unknown>) => unknown;
  } catch (e) {
    if (e instanceof SyntaxError) {
      throw new AdvancementJsExprError('Sintassi non ammessa; usa solo espressioni JS standard.');
    }
    throw e instanceof Error ? e : new AdvancementJsExprError(String(e));
  }
}

/**
 * Verifica sintassi (parse) senza eseguire — utile dopo traduzione IA.
 */
export function validateAdvancementJsSyntax(source: string): void {
  compileAdvancementExprFn(source);
}

export function evaluateAdvancementJsExpression(
  source: string,
  ctx: { prev: Record<string, unknown>; param: Record<string, unknown> }
): unknown {
  const fn = compileAdvancementExprFn(source);
  const param = Object.freeze({ ...ctx.param }) as Record<string, unknown>;
  const prev = Object.freeze({ ...ctx.prev }) as Record<string, unknown>;
  try {
    const out = fn(param, prev);
    if (typeof out === 'function') {
      throw new AdvancementJsExprError(ADVANCEMENT_BARE_ARROW_SYNTAX_MESSAGE);
    }
    return out;
  } catch (e) {
    if (e instanceof AdvancementJsExprError) throw e;
    throw new AdvancementJsExprError(e instanceof Error ? e.message : String(e));
  }
}
