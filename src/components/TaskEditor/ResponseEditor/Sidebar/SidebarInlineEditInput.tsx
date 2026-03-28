/**
 * Inline rename input for sidebar tree rows. Focus/select in useLayoutEffect when `active`.
 * widthMode: `fill` stretches in the flex row (new empty node); `autosize` sizes to content.
 */

import React, { useLayoutEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { SIDEBAR_ROW_LABEL_INPUT_STYLE } from '@responseEditor/Sidebar/sidebarRowLabelInputStyle';
import type { SidebarLabelWidthMode } from '@responseEditor/Sidebar/sidebarLabelEditWidth';

export interface SidebarInlineEditInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'ref'> {
  /** When true (typically on mount of this row as the editor), focus and select after the input exists. */
  active: boolean;
  /** fill: use remaining row width; autosize: width from text (capped by row). */
  widthMode?: SidebarLabelWidthMode;
}

const FILL_STYLE: CSSProperties = {
  flex: 1,
  minWidth: 0,
  width: '100%',
  maxWidth: '100%',
};

const AUTOSIZE_BASE: CSSProperties = {
  flex: '0 1 auto',
  minWidth: '2ch',
  maxWidth: '100%',
  width: '2ch',
};

/**
 * Controlled text input: focus/select when active; width follows widthMode and value.
 */
export function SidebarInlineEditInput({
  active,
  widthMode = 'autosize',
  value,
  style,
  ...inputProps
}: SidebarInlineEditInputProps): React.ReactElement {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useLayoutEffect(() => {
    if (!active || !inputRef.current) return;
    inputRef.current.focus();
    inputRef.current.select();
  }, [active]);

  useLayoutEffect(() => {
    if (!active || widthMode !== 'autosize' || !inputRef.current) return;
    const el = inputRef.current;
    el.style.width = '0px';
    const sw = el.scrollWidth;
    const parent = el.parentElement;
    /** Reserve space for checkbox, icons, chevron, parser (~100px). */
    const cap = parent ? Math.max(48, parent.clientWidth - 100) : sw;
    el.style.width = `${Math.min(sw, cap)}px`;
  }, [active, widthMode, value]);

  const mergedStyle: CSSProperties = {
    ...SIDEBAR_ROW_LABEL_INPUT_STYLE,
    ...(widthMode === 'fill' ? FILL_STYLE : AUTOSIZE_BASE),
    ...style,
  };

  return (
    <input
      ref={inputRef}
      value={value}
      {...inputProps}
      style={mergedStyle}
    />
  );
}
