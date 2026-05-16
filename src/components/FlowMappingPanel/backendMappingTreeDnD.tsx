/**
 * Hit-test e linee di anteprima per drag parametri backend sull’albero Arborist.
 */

import React from 'react';
import type { ParamDropPlacement } from './backendParamInsert';

export type DropPreviewTone = 'amber' | 'teal' | 'emerald';

export function placementFromY(clientY: number, rowRect: DOMRect, hasChildren: boolean): ParamDropPlacement {
  const y = clientY - rowRect.top;
  const t = rowRect.height > 0 ? y / rowRect.height : 0.5;
  if (hasChildren) {
    if (t < 0.28) return 'before';
    if (t > 0.72) return 'after';
    return 'child';
  }
  return t < 0.5 ? 'before' : 'after';
}

export function findBackendMapRowElementFromPoint(clientX: number, clientY: number): HTMLElement | null {
  try {
    const stack = document.elementsFromPoint(clientX, clientY);
    for (const n of stack) {
      if (!(n instanceof HTMLElement)) continue;
      const row = n.closest('[data-backend-map-row]');
      if (row instanceof HTMLElement) return row;
    }
  } catch {
    return null;
  }
  return null;
}

export function DropPreviewLine({
  indentPx = 0,
  tone = 'amber',
}: {
  indentPx?: number;
  tone?: DropPreviewTone;
}) {
  const toneClass =
    tone === 'teal'
      ? 'bg-teal-400 shadow-[0_0_10px_rgba(45,212,191,0.55)]'
      : tone === 'emerald'
        ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.55)]'
        : 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.55)]';
  return (
    <div
      className={`h-0.5 rounded-full pointer-events-none ${toneClass}`}
      style={{ marginLeft: indentPx }}
      aria-hidden
    />
  );
}
