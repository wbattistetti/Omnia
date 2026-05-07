/**
 * Freccia SEND “a blocco”: un solo contorno chiuso — asta rettangolare + punta triangolare senza segmenti separati.
 * Opzionale = solo contorno (interno vuoto); obbligatorio = fill + contorno sottile; runtime = asta spezzata (due poligoni + gap).
 */

import React from 'react';

const STROKE = 0.72;
const EDGE = 'currentColor';
const INNER = 'rgba(45, 212, 191, 0.42)';

/** Geometria base (freccia →): pentagono [bl-sx]–[base dx basso]–[punta]–[base dx alto]–[al-sx]. */
const XL = 0.85;
const X_SHAFT_RIGHT = 8.35;
const TIP_X = 14.85;
const Y_TOP = 3.75;
const Y_BOT = 8.25;

/** Spezzatura runtime: fine primo blocco asta / inizio secondo (gap tra i due). */
const X_BREAK_LEFT = 3.95;
const X_BREAK_RIGHT = 5.35;

function pathContinuous(): string {
  return `M ${XL} ${Y_BOT} L ${X_SHAFT_RIGHT} ${Y_BOT} L ${TIP_X} 6 L ${X_SHAFT_RIGHT} ${Y_TOP} L ${XL} ${Y_TOP} Z`;
}

/** Due poligoni chiusi: segmento asta sinistro + (segmento destro + punta). */
function pathBroken(): string {
  const leftShaft = `M ${XL} ${Y_TOP} L ${X_BREAK_LEFT} ${Y_TOP} L ${X_BREAK_LEFT} ${Y_BOT} L ${XL} ${Y_BOT} Z`;
  const rightAndHead = `M ${X_BREAK_RIGHT} ${Y_TOP} L ${X_SHAFT_RIGHT} ${Y_TOP} L ${TIP_X} 6 L ${X_SHAFT_RIGHT} ${Y_BOT} L ${X_BREAK_RIGHT} ${Y_BOT} Z`;
  return `${leftShaft} ${rightAndHead}`;
}

export type SendArrowGlyphKind = 'filledSolid' | 'outlineSolid' | 'filledBroken' | 'outlineBroken';

export function BackendSendArrowIcon({ kind, title }: { kind: SendArrowGlyphKind; title?: string }) {
  const filled = kind === 'filledSolid' || kind === 'filledBroken';
  const broken = kind === 'filledBroken' || kind === 'outlineBroken';
  const d = broken ? pathBroken() : pathContinuous();

  return (
    <svg
      className="w-[1.28rem] h-[1.05rem] text-teal-400 drop-shadow-[0_0_5px_rgba(45,212,191,0.35)] shrink-0"
      viewBox="0 0 16 12"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title ? <title>{title}</title> : null}
      <path
        d={d}
        fill={filled ? INNER : 'none'}
        stroke={EDGE}
        strokeWidth={STROKE}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function resolveSendArrowKind(
  apiField: string | undefined,
  entry: {
    sendBindingOptional?: boolean;
    sendBindingBindingPhase?: 'design' | 'runtime';
  }
): SendArrowGlyphKind {
  const optional = Boolean(entry.sendBindingOptional);
  const api = (apiField || '').trim();
  const phase: 'design' | 'runtime' =
    entry.sendBindingBindingPhase ||
    (api === 'conversationId' || api === 'forceRefresh' ? 'runtime' : 'design');
  const broken = phase === 'runtime';
  const filled = !optional;
  if (broken) return filled ? 'filledBroken' : 'outlineBroken';
  return filled ? 'filledSolid' : 'outlineSolid';
}

export function sendArrowTitle(kind: SendArrowGlyphKind): string {
  const base = 'Parametro in uscita (verso API). ';
  if (kind === 'filledSolid') return base + 'Obbligatorio a design-time.';
  if (kind === 'outlineSolid') return base + 'Opzionale a design-time.';
  if (kind === 'filledBroken') return base + 'Runtime (valorizzato a esecuzione).';
  return base + 'Runtime opzionale in SEND.';
}
