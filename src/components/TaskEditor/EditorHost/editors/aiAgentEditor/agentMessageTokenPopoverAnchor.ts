/**
 * Ancoraggio viewport per il popover token messaggio agente (flip verticale/orizzontale se serve).
 */

export type AgentMessageTokenPopoverAnchor = {
  /** Punto sotto la riga del caret (default placement). */
  top: number;
  left: number;
  /** Top viewport della riga del caret (per flip verso l'alto). */
  caretTop: number;
};

const VIEWPORT_MARGIN_PX = 8;
const GAP_BELOW_CARET_PX = 6;
const GAP_ABOVE_CARET_PX = 6;

/** Costruisce l'ancora sotto il caret a partire dal punto viewport del caret. */
export function buildTokenPopoverAnchorBelowCaret(
  caretViewport: { top: number; left: number },
  lineHeightPx: number
): AgentMessageTokenPopoverAnchor {
  return {
    caretTop: caretViewport.top,
    left: caretViewport.left,
    top: caretViewport.top + lineHeightPx + GAP_BELOW_CARET_PX,
  };
}

export type FloatingPopoverPlacement = 'below' | 'above';

export type FloatingPopoverPosition = {
  top: number;
  /** Angolo superiore sinistro del popover in coordinate viewport. */
  left: number;
  placement: FloatingPopoverPlacement;
};

/**
 * Posizione fixed del popover dopo misura dimensioni.
 * Orizzontale: allinea il bordo destro al caret; se esce a sinistra, flip verso destra; poi clamp nel viewport.
 */
export function resolveFloatingPopoverPosition(params: {
  anchor: AgentMessageTokenPopoverAnchor;
  popoverWidth: number;
  popoverHeight: number;
  viewportWidth?: number;
  viewportHeight?: number;
}): FloatingPopoverPosition {
  const vw =
    params.viewportWidth ?? (typeof window !== 'undefined' ? window.innerWidth : 1024);
  const vh =
    params.viewportHeight ?? (typeof window !== 'undefined' ? window.innerHeight : 800);
  const w = Math.max(0, params.popoverWidth);
  const h = Math.max(0, params.popoverHeight);
  const caretLeft = params.anchor.left;
  const margin = VIEWPORT_MARGIN_PX;
  const maxLeft = Math.max(margin, vw - margin - w);

  let left = caretLeft - w;
  if (left < margin) {
    left = caretLeft;
  }
  left = Math.max(margin, Math.min(left, maxLeft));

  const belowTop = params.anchor.top;
  if (belowTop + h <= vh - margin) {
    return { top: belowTop, left, placement: 'below' };
  }
  const aboveTop = params.anchor.caretTop - GAP_ABOVE_CARET_PX - h;
  return {
    top: Math.max(margin, aboveTop),
    left,
    placement: 'above',
  };
}

/**
 * @deprecated Preferire {@link resolveFloatingPopoverPosition} (include anche `left`).
 */
export function resolveFloatingPopoverTop(params: {
  anchor: AgentMessageTokenPopoverAnchor;
  popoverHeight: number;
  viewportHeight?: number;
}): { top: number; placement: FloatingPopoverPlacement } {
  const { top, placement } = resolveFloatingPopoverPosition({
    anchor: params.anchor,
    popoverWidth: 0,
    popoverHeight: params.popoverHeight,
    viewportHeight: params.viewportHeight,
  });
  return { top, placement };
}
