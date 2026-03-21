/**
 * Single-line text input whose width follows content (typing grows the field).
 * Measures a mirror span (absolute, off-flow) and sets input width in px so the
 * browser default <input> min-width does not leave empty space inside the border.
 */

import React, { useLayoutEffect, useRef } from 'react';

/** ~16rem at default root; align with typical max-w-[16rem] */
const DEFAULT_MAX_WIDTH_PX = 256;

export interface AutosizeOneLineInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'width' | 'style'> {
  /** Mirror typography / padding; must match horizontal box model of inputClassName. */
  mirrorClassName: string;
  /** Borders, colors, focus ring on the real input. */
  inputClassName: string;
  /** Cap grown width, e.g. max-w-[min(16rem,92vw)] */
  maxWidthClassName?: string;
  /** Hard pixel cap for measured width (align with maxWidthClassName). */
  maxWidthPx?: number;
  /** When value and placeholder are empty, reserve at least this many characters. */
  minChars?: number;
}

/** Exposed for unit tests (padding empty / placeholder / value cases). */
export function measureSource(value: string, placeholder: string | undefined, minChars: number): string {
  const base = value.length > 0 ? value : placeholder && placeholder.length > 0 ? placeholder : '';
  if (base.length >= minChars) return base;
  return base.padEnd(minChars, '\u00a0');
}

function mergeRefs<T>(...refs: Array<React.Ref<T> | undefined>) {
  return (node: T | null) => {
    for (const r of refs) {
      if (typeof r === 'function') r(node);
      else if (r && 'current' in r) (r as React.MutableRefObject<T | null>).current = node;
    }
  };
}

export const AutosizeOneLineInput = React.forwardRef<HTMLInputElement, AutosizeOneLineInputProps>(
  function AutosizeOneLineInput(
    {
      mirrorClassName,
      inputClassName,
      maxWidthClassName = 'max-w-[min(16rem,92vw)]',
      maxWidthPx = DEFAULT_MAX_WIDTH_PX,
      minChars = 4,
      value,
      placeholder,
      ...rest
    },
    ref
  ) {
    const str = typeof value === 'string' ? value : '';
    const measureText = measureSource(str, placeholder, minChars);
    const mirrorRef = useRef<HTMLSpanElement>(null);
    const inputLocalRef = useRef<HTMLInputElement>(null);

    useLayoutEffect(() => {
      const mirror = mirrorRef.current;
      const input = inputLocalRef.current;
      if (!mirror || !input) return;
      const raw = mirror.offsetWidth;
      const w = Math.min(maxWidthPx, Math.max(1, raw));
      input.style.width = `${w}px`;
    }, [measureText, mirrorClassName, maxWidthPx, inputClassName]);

    return (
      <span className={`relative inline-block min-w-0 align-middle ${maxWidthClassName}`}>
        <span
          ref={mirrorRef}
          className={`pointer-events-none absolute left-0 top-0 -z-10 whitespace-pre select-none border border-transparent box-border opacity-0 ${mirrorClassName}`}
          aria-hidden
        >
          {measureText}
        </span>
        <input
          ref={mergeRefs(inputLocalRef, ref)}
          type="text"
          size={1}
          value={value}
          placeholder={placeholder}
          className={`relative z-10 box-border min-w-0 max-w-full ${inputClassName}`}
          {...rest}
        />
      </span>
    );
  }
);

AutosizeOneLineInput.displayName = 'AutosizeOneLineInput';
