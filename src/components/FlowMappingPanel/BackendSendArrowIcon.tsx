/**
 * Icone riga SEND/RECEIVE nel mapping Backend Call (Lucide).
 * SEND: ArrowBigRight (design) / ArrowBigRightDash (runtime); filled vs outline = obbligatorio vs opzionale.
 * RECEIVE: ArrowBigLeft arancione; filled vs outline come sopra (flag opzionale su entry se presente).
 */

import React from 'react';
import { ArrowBigLeft, ArrowBigRight, ArrowBigRightDash } from 'lucide-react';

/** Blu SEND (#4A90E2). */
export const BACKEND_SEND_MAPPING_ICON_COLOR = '#4A90E2';
/** Arancione RECEIVE (#F5A623). */
export const BACKEND_RECEIVE_MAPPING_ICON_COLOR = '#F5A623';

/** Larghezza ×1.5 rispetto al ciclo precedente (39→59); altezza ridotta (meno “alte”). */
const GLYPH_W = 59;
const GLYPH_H = 22;
const GLYPH_CLASS = `h-[22px] w-[59px] shrink-0`;
const SEND_SHADOW = 'drop-shadow-[0_0_5px_rgba(74,144,226,0.35)]';
const RECV_SHADOW = 'drop-shadow-[0_0_5px_rgba(245,166,35,0.4)]';

export type SendArrowGlyphKind = 'filledSolid' | 'outlineSolid' | 'filledBroken' | 'outlineBroken';

export function BackendSendArrowIcon({ kind, title }: { kind: SendArrowGlyphKind; title?: string }) {
  const runtime = kind === 'filledBroken' || kind === 'outlineBroken';
  const filled = kind === 'filledSolid' || kind === 'filledBroken';
  const Icon = runtime ? ArrowBigRightDash : ArrowBigRight;
  const c = BACKEND_SEND_MAPPING_ICON_COLOR;
  return (
    <Icon
      className={`${GLYPH_CLASS} ${SEND_SHADOW}`}
      width={GLYPH_W}
      height={GLYPH_H}
      strokeWidth={2.15}
      fill={filled ? c : 'none'}
      stroke={c}
      title={title}
      aria-hidden={title ? undefined : true}
    />
  );
}

export function BackendReceiveArrowIcon({ optional }: { optional: boolean }) {
  const c = BACKEND_RECEIVE_MAPPING_ICON_COLOR;
  const filled = !optional;
  return (
    <ArrowBigLeft
      className={`${GLYPH_CLASS} ${RECV_SHADOW}`}
      width={GLYPH_W}
      height={GLYPH_H}
      strokeWidth={2.15}
      fill={filled ? c : 'none'}
      stroke={c}
      aria-hidden
    />
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
