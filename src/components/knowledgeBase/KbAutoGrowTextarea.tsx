/**
 * Textarea che cresce con il contenuto fino a maxHeightPx, poi scrollbar verticale.
 */

import React from 'react';

export type KbAutoGrowTextareaProps = Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  'rows'
> & {
  maxHeightPx?: number;
  minHeightPx?: number;
  /** Altezza massima in righe di testo; ha priorità su maxHeightPx se entrambi presenti. */
  maxRows?: number;
};

export const KbAutoGrowTextarea = React.forwardRef<
  HTMLTextAreaElement,
  KbAutoGrowTextareaProps
>(function KbAutoGrowTextarea(
  { maxHeightPx = 240, minHeightPx, maxRows, className = '', value, ...rest },
  ref
) {
  const localRef = React.useRef<HTMLTextAreaElement>(null);

  const mergedRef = React.useCallback(
    (node: HTMLTextAreaElement | null) => {
      localRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    },
    [ref]
  );

  const measureLineMetrics = React.useCallback((el: HTMLTextAreaElement) => {
    const style = window.getComputedStyle(el);
    const lineHeight = parseFloat(style.lineHeight);
    const paddingTop = parseFloat(style.paddingTop) || 0;
    const paddingBottom = parseFloat(style.paddingBottom) || 0;
    const borderTop = parseFloat(style.borderTopWidth) || 0;
    const borderBottom = parseFloat(style.borderBottomWidth) || 0;
    const effectiveLineHeight = Number.isFinite(lineHeight) ? lineHeight : 18;
    const chrome = paddingTop + paddingBottom + borderTop + borderBottom;
    const oneLineMin = effectiveLineHeight + chrome;
    return { effectiveLineHeight, chrome, oneLineMin };
  }, []);

  const resize = React.useCallback(() => {
    const el = localRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const { effectiveLineHeight, chrome, oneLineMin } = measureLineMetrics(el);
    const floor = minHeightPx ?? oneLineMin;
    const maxCap =
      maxRows != null && maxRows > 0
        ? chrome + effectiveLineHeight * maxRows
        : maxHeightPx;
    const capped = Math.min(el.scrollHeight, maxCap);
    el.style.height = `${Math.max(capped, floor)}px`;
    el.style.overflowY = el.scrollHeight > maxCap ? 'auto' : 'hidden';
  }, [maxHeightPx, maxRows, minHeightPx, measureLineMetrics]);

  React.useLayoutEffect(() => {
    resize();
  }, [value, resize, className]);

  return (
    <textarea
      ref={mergedRef}
      rows={1}
      value={value}
      onInput={resize}
      className={`box-border min-h-[1.5rem] w-full max-w-full resize-none ${className}`}
      {...rest}
    />
  );
});

KbAutoGrowTextarea.displayName = 'KbAutoGrowTextarea';
