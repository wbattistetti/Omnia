/**
 * Applica un valore su un path puntato OpenAPI (es. queryConstraints.horizon.end) su un body JSON.
 */

import { resolveValueKindToConcrete } from './valueKindResolver';
import type { SurfaceSendHint } from './types';

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

/**
 * Imposta `value` su `target` seguendo segmenti separati da `.` (solo oggetti annidati).
 */
export function setNestedValueAtDottedPath(
  target: Record<string, unknown>,
  dottedPath: string,
  value: unknown
): void {
  const parts = dottedPath
    .split('.')
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return;

  let cur: Record<string, unknown> = target;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i];
    const next = cur[key];
    if (!isRecord(next)) {
      cur[key] = {};
    }
    cur = cur[key] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
}

/**
 * Risolve il valore concreto per un hint (valueKind + surface) e lo scrive nel body.
 */
export function applySendHintToBody(
  body: Record<string, unknown>,
  hint: Pick<SurfaceSendHint, 'sendPath' | 'valueKind' | 'surface'>,
  options?: { referenceDate?: Date }
): boolean {
  const path = hint.sendPath.trim();
  if (!path) return false;

  let concrete: string | null = null;
  if (hint.valueKind?.trim()) {
    concrete = resolveValueKindToConcrete(hint.valueKind, {
      referenceDate: options?.referenceDate,
      surfaceLiteral: hint.surface,
    });
  }
  if (concrete == null) return false;

  setNestedValueAtDottedPath(body, path, concrete);
  return true;
}

/**
 * Applica più hint SEND sullo stesso body (merge incrementale).
 */
export function applySendHintsToBody(
  body: Record<string, unknown>,
  hints: readonly SurfaceSendHint[],
  options?: { referenceDate?: Date }
): number {
  let applied = 0;
  for (const h of hints) {
    if (applySendHintToBody(body, h, options)) applied += 1;
  }
  return applied;
}
