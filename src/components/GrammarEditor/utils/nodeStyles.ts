// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import type { GrammarNode } from '../types/grammarTypes';

/**
 * Node styling utilities.
 * Centralized styling logic for consistency.
 */

/**
 * Gets the background color for a node based on its semantic type.
 */
export function getNodeBackground(semanticType: GrammarNode['semanticType']): string {
  if (semanticType === 'value') return '#2a2010';
  if (semanticType === 'set') return '#1e2010';
  return '#1a1f2e';
}

/**
 * Gets the border color for a node based on selection state.
 */
export function getBorderColor(selected: boolean): string {
  return selected ? '#3b82f6' : '#4a5568';
}

/**
 * Base styles for node container.
 */
export const nodeBaseStyles: React.CSSProperties = {
  padding: '2px 6px',
  borderRadius: '3px',
  fontSize: '13px',
  fontFamily: 'sans-serif',
  textAlign: 'center',
  lineHeight: '1.4',
  color: '#c9d1d9',
  boxSizing: 'border-box',
  whiteSpace: 'nowrap',
  overflow: 'visible', // Must be visible so the absolute-positioned toolbar above is not clipped
};

/**
 * Base styles for node input field.
 */
export const nodeInputStyles: React.CSSProperties = {
  border: 'none',
  outline: 'none',
  background: 'transparent',
  textAlign: 'center',
  fontWeight: 'normal',
  width: '100%',
  fontSize: '13px',
  fontFamily: 'sans-serif',
  padding: 0,
  margin: 0,
  cursor: 'text',
  color: '#c9d1d9',
};

/**
 * Styles for node label text.
 */
export const nodeLabelStyles: React.CSSProperties = {
  fontSize: '13px',
  fontFamily: 'sans-serif',
  color: '#c9d1d9',
};

/**
 * Styles for node metadata (synonyms, slot, optional).
 */
export const nodeMetadataStyles = {
  synonyms: {
    fontSize: '8px',
    color: '#6b7280',
    marginTop: '1px',
  } as React.CSSProperties,
  slot: {
    fontSize: '8px',
    color: '#059669',
    marginTop: '1px',
  } as React.CSSProperties,
  optional: {
    fontSize: '7px',
    color: '#dc2626',
    marginTop: '1px',
  } as React.CSSProperties,
};
