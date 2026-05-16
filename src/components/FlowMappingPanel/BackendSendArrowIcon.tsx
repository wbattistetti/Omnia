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

const GLYPH_W_DEFAULT = 59;
const GLYPH_H_DEFAULT = 22;
const GLYPH_W_COMPACT = 76;
const GLYPH_H_COMPACT = 16;
/** SEND: blu mapping (#4A90E2) — obbligatorio = fill pieno, opzionale = solo stroke. */
const SEND_SHADOW = 'drop-shadow-[0_0_6px_rgba(74,144,226,0.45)]';
const RECV_SHADOW = 'drop-shadow-[0_0_5px_rgba(245,166,35,0.4)]';

export type SendArrowGlyphKind = 'filledSolid' | 'outlineSolid' | 'filledBroken' | 'outlineBroken';

export function BackendSendArrowIcon({
  kind,
  title,
  compact = false,
}: {
  kind: SendArrowGlyphKind;
  title?: string;
  compact?: boolean;
}) {
  const runtime = kind === 'filledBroken' || kind === 'outlineBroken';
  const filled = kind === 'filledSolid' || kind === 'filledBroken';
  const Icon = runtime ? ArrowBigRightDash : ArrowBigRight;
  const c = BACKEND_SEND_MAPPING_ICON_COLOR;
  const strokeC = c;
  const fillC = filled ? c : 'none';
  const w = compact ? GLYPH_W_COMPACT : GLYPH_W_DEFAULT;
  const h = compact ? GLYPH_H_COMPACT : GLYPH_H_DEFAULT;
  const cls = compact ? `h-4 w-[38px] shrink-0` : `h-[22px] w-[59px] shrink-0`;
  return (
    <Icon
      className={`${cls} ${SEND_SHADOW}`}
      width={w}
      height={h}
      strokeWidth={2.15}
      fill={fillC}
      stroke={strokeC}
      title={title}
      aria-hidden={title ? undefined : true}
    />
  );
}

export function BackendReceiveArrowIcon({
  optional,
  compact = false,
}: {
  optional: boolean;
  compact?: boolean;
}) {
  const c = BACKEND_RECEIVE_MAPPING_ICON_COLOR;
  const filled = !optional;
  const fillC = filled ? c : 'none';
  const strokeC = c;
  const w = compact ? GLYPH_W_COMPACT : GLYPH_W_DEFAULT;
  const h = compact ? GLYPH_H_COMPACT : GLYPH_H_DEFAULT;
  const cls = compact ? `h-4 w-[76px] shrink-0` : `h-[22px] w-[59px] shrink-0`;
  return (
    <ArrowBigLeft
      className={`${cls} ${RECV_SHADOW}`}
      width={w}
      height={h}
      strokeWidth={2.15}
      fill={fillC}
      stroke={strokeC}
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
