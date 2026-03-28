/**
 * Inline label `<input>` inside flex sidebar rows (main / sub / nested).
 * `minWidth: 0` lets the field shrink inside indented rows; without it, flex
 * defaults (`min-width: auto`) let the input overflow the row.
 */

import type { CSSProperties } from 'react';

export const SIDEBAR_ROW_LABEL_INPUT_STYLE: CSSProperties = {
  flex: 1,
  minWidth: 0,
  maxWidth: '100%',
  boxSizing: 'border-box',
  background: '#0f172a',
  color: '#e5e7eb',
  border: '1px solid #334155',
  borderRadius: 4,
  padding: '2px 6px',
  outline: 'none',
  fontSize: 'inherit',
  fontFamily: 'inherit',
  margin: 0,
};
